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
		switch msg.String() {
		case "q", "ctrl+c":
			// Kill any running process before quitting
			if m.runningCmd != nil && m.runningCmd.Process != nil {
				m.runningCmd.Process.Kill()
			}
			return m, tea.Quit

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
			m.prd = msg.PRD
			m.stories = msg.PRD.UserStories
			m.completedCount = CountCompleted(m.stories)

			if m.completedCount == len(m.stories) {
				m.processDone = true
			}
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
