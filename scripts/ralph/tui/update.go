package main

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.showHelp {
			switch msg.String() {
			case "?", "esc":
				m.showHelp = false
			case "q", "ctrl+c":
				if m.runningCmd != nil && m.runningCmd.Process != nil {
					m.runningCmd.Process.Kill()
				}
				return m, tea.Quit
			}
			return m, nil
		}

		if m.searchMode {
			switch msg.String() {
			case "esc":
				m.searchMode = false
				m.searchQuery = ""
			case "enter":
				m.searchMode = false
			case "backspace":
				if len(m.searchQuery) > 0 {
					m.searchQuery = m.searchQuery[:len(m.searchQuery)-1]
				}
			default:
				if len(msg.String()) == 1 {
					m.searchQuery += msg.String()
				}
			}
			return m, nil
		}

		switch msg.String() {
		case "?":
			m.showHelp = true

		case "q", "ctrl+c":
			if m.runningCmd != nil && m.runningCmd.Process != nil {
				m.runningCmd.Process.Kill()
			}
			return m, tea.Quit

		case "/":
			m.searchMode = true
			m.searchQuery = ""

		case "tab":
			if m.focusedPanel == PanelStories {
				m.focusedPanel = PanelOutput
			} else {
				m.focusedPanel = PanelStories
			}

		case "up", "k":
			if m.focusedPanel == PanelStories {
				if m.storyScroll > 0 {
					m.storyScroll--
				}
			} else {
				m.outputViewport.LineUp(1)
			}

		case "down", "j":
			if m.focusedPanel == PanelStories {
				maxScroll := len(m.stories) - 10
				if maxScroll < 0 {
					maxScroll = 0
				}
				if m.storyScroll < maxScroll {
					m.storyScroll++
				}
			} else {
				m.outputViewport.LineDown(1)
			}

		case "g":
			if m.focusedPanel == PanelOutput {
				m.outputViewport.GotoTop()
			} else {
				m.storyScroll = 0
			}

		case "G":
			if m.focusedPanel == PanelOutput {
				m.outputViewport.GotoBottom()
			} else {
				maxScroll := len(m.stories) - 10
				if maxScroll < 0 {
					maxScroll = 0
				}
				m.storyScroll = maxScroll
			}

		case "r":
			if !m.processRunning && !m.processDone {
				return m, m.startIteration()
			}
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		outputHeight := m.height - 10
		if outputHeight < 5 {
			outputHeight = 5
		}
		outputWidth := m.width/2 - 4
		if outputWidth < 20 {
			outputWidth = 20
		}

		m.outputViewport.Width = outputWidth
		m.outputViewport.Height = outputHeight

	case PRDUpdatedMsg:
		if msg.Err == nil {
			oldCompleted := m.completedCount
			m.prd = msg.PRD
			m.stories = msg.PRD.UserStories
			m.completedCount = CountCompleted(m.stories)

			if m.currentStoryID != "" && m.completedCount > oldCompleted {
				story := GetStoryByID(m.stories, m.currentStoryID)
				if story != nil && story.Passes {
					if startTime, exists := m.storyStartTimes[m.currentStoryID]; exists {
						duration := time.Since(startTime)
						m.storyDurations[m.currentStoryID] = duration
					}
				}
			}

			if m.completedCount == len(m.stories) {
				m.processDone = true
			}

			m.prdUpdateNotif = "✓ PRD updated"
			m.prdUpdateNotifEnd = time.Now().Add(3 * time.Second)
		}
		cmds = append(cmds, watchPRDCmd(m.prdPath))

	case OutputLineMsg:
		formattedLine := formatTimestamp(msg.Timestamp) + " " + msg.Line
		m.outputLines = append(m.outputLines, formattedLine)
		m.outputViewport.SetContent(strings.Join(m.outputLines, "\n"))
		m.outputViewport.GotoBottom()

		if storyID, found := parseStoryFromLine(msg.Line); found {
			m.currentStoryID = storyID
		}

		if checkCompleteSignal(msg.Line) {
			m.processDone = true
		}

		cmds = append(cmds, listenForOutputCmd(m.msgChan))

	case ProcessStartedMsg:
		m.currentIteration = msg.Iteration
		m.currentStoryID = msg.StoryID
		m.iterationStart = time.Now()
		m.storyStartTimes[msg.StoryID] = time.Now()
		m.processRunning = true
		m.runningCmd = msg.Cmd
		cmds = append(cmds, listenForOutputCmd(m.msgChan))

	case ProcessExitedMsg:
		m.processRunning = false
		m.runningCmd = nil

		if msg.Complete || m.processDone {
			m.processDone = true
		} else if m.currentIteration < m.maxIterations && m.completedCount < len(m.stories) {
			cmds = append(cmds, m.startIteration())
		}

	case TickMsg:
		if !m.prdUpdateNotifEnd.IsZero() && time.Now().After(m.prdUpdateNotifEnd) {
			m.prdUpdateNotif = ""
			m.prdUpdateNotifEnd = time.Time{}
		}
		cmds = append(cmds, tickCmd())

	case ErrorMsg:
		m.processError = msg.Err
	}

	return m, tea.Batch(cmds...)
}

func (m *Model) startIteration() tea.Cmd {
	m.currentIteration++

	nextStory := GetNextStory(m.stories)
	storyID := ""
	if nextStory != nil {
		storyID = nextStory.ID
		m.currentStoryID = storyID
	}

	m.iterationStart = time.Now()
	m.processRunning = true

	m.outputLines = append(m.outputLines, "")
	m.outputLines = append(m.outputLines, formatTimestamp(time.Now())+" "+strings.Repeat("═", 40))
	m.outputLines = append(m.outputLines, formatTimestamp(time.Now())+" Starting iteration "+string(rune('0'+m.currentIteration))+" - "+storyID)
	m.outputLines = append(m.outputLines, formatTimestamp(time.Now())+" "+strings.Repeat("═", 40))
	m.outputViewport.SetContent(strings.Join(m.outputLines, "\n"))
	m.outputViewport.GotoBottom()

	return tea.Batch(
		runIterationCmd(m.promptPath, m.projectRoot, m.currentIteration, storyID, m.msgChan),
		listenForOutputCmd(m.msgChan),
	)
}
