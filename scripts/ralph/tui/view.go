package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

func (m Model) View() string {
	if m.width == 0 || m.height == 0 {
		return "Loading..."
	}

	header := m.renderHeader()
	progress := m.renderProgress()
	mainContent := m.renderMainContent()
	statusBar := m.renderStatusBar()

	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		progress,
		mainContent,
		statusBar,
	)
}

func (m Model) renderHeader() string {
	title := HeaderStyle.Render(" Ralph ")

	iterationText := fmt.Sprintf("Iteration %d", m.currentIteration)
	if m.maxIterations > 0 {
		iterationText = fmt.Sprintf("Iteration %d/%d", m.currentIteration, m.maxIterations)
	}

	help := HelpStyle.Render("q: quit │ tab: switch panel │ r: restart")

	spacer := strings.Repeat(" ", max(0, m.width-lipgloss.Width(title)-lipgloss.Width(iterationText)-lipgloss.Width(help)-4))

	return lipgloss.JoinHorizontal(
		lipgloss.Center,
		title,
		spacer,
		iterationText,
		"  ",
		help,
	)
}

func (m Model) renderProgress() string {
	total := len(m.stories)
	if total == 0 {
		return ""
	}

	percent := float64(m.completedCount) / float64(total)
	barWidth := m.width - 30
	if barWidth < 20 {
		barWidth = 20
	}

	filledWidth := int(float64(barWidth) * percent)
	emptyWidth := barWidth - filledWidth

	filled := ProgressBarFilled.Render(strings.Repeat("█", filledWidth))
	empty := ProgressBarEmpty.Render(strings.Repeat("░", emptyWidth))
	bar := filled + empty

	label := fmt.Sprintf("Progress: %d/%d stories", m.completedCount, total)
	percentText := fmt.Sprintf("%d%%", int(percent*100))

	line1 := "  " + label
	line2 := "  " + bar + "  " + percentText

	return lipgloss.JoinVertical(lipgloss.Left, "", line1, line2, "")
}

func (m Model) renderMainContent() string {
	panelHeight := m.height - 12
	if panelHeight < 5 {
		panelHeight = 5
	}

	leftWidth := m.width/2 - 2
	rightWidth := m.width - leftWidth - 4

	storiesPanel := m.renderStoriesPanel(leftWidth, panelHeight)
	outputPanel := m.renderOutputPanel(rightWidth, panelHeight)

	return lipgloss.JoinHorizontal(
		lipgloss.Top,
		storiesPanel,
		outputPanel,
	)
}

func (m Model) renderStoriesPanel(width, height int) string {
	var style lipgloss.Style
	if m.focusedPanel == PanelStories {
		style = PanelActiveStyle.Width(width).Height(height)
	} else {
		style = PanelStyle.Width(width).Height(height)
	}

	title := PanelTitleStyle.Render("Stories")

	var storyLines []string
	visibleCount := height - 3
	if visibleCount < 1 {
		visibleCount = 1
	}

	startIdx := m.storyScroll
	endIdx := startIdx + visibleCount
	if endIdx > len(m.stories) {
		endIdx = len(m.stories)
	}

	for i := startIdx; i < endIdx; i++ {
		story := m.stories[i]
		line := m.renderStoryLine(story, width-4)
		storyLines = append(storyLines, line)
	}

	if len(m.stories) > visibleCount {
		scrollIndicator := HelpStyle.Render(fmt.Sprintf("  ↑↓ to scroll (%d-%d of %d)", startIdx+1, endIdx, len(m.stories)))
		storyLines = append(storyLines, scrollIndicator)
	}

	content := lipgloss.JoinVertical(lipgloss.Left, title, strings.Join(storyLines, "\n"))

	return style.Render(content)
}

func (m Model) renderStoryLine(story Story, maxWidth int) string {
	var statusIcon string
	var style lipgloss.Style

	isCurrent := story.ID == m.currentStoryID

	switch {
	case story.Passes:
		statusIcon = SuccessIcon
		style = StoryDoneStyle
	case isCurrent:
		statusIcon = CurrentIcon
		style = StoryCurrentStyle
	default:
		statusIcon = PendingIcon
		style = StoryPendingStyle
	}

	ultraworkIcon := NoUltrawork
	if story.Ultrawork {
		ultraworkIcon = UltraworkIcon
	}

	titleMaxLen := maxWidth - 11
	if titleMaxLen < 10 {
		titleMaxLen = 10
	}

	title := story.Title
	if len(title) > titleMaxLen {
		title = title[:titleMaxLen-3] + "..."
	}

	return fmt.Sprintf("%s %s %s %s", ultraworkIcon, statusIcon, story.ID, style.Render(title))
}

func (m Model) renderOutputPanel(width, height int) string {
	var style lipgloss.Style
	if m.focusedPanel == PanelOutput {
		style = PanelActiveStyle.Width(width).Height(height)
	} else {
		style = PanelStyle.Width(width).Height(height)
	}

	title := PanelTitleStyle.Render("Output")

	m.outputViewport.Width = width - 4
	m.outputViewport.Height = height - 3

	content := lipgloss.JoinVertical(lipgloss.Left, title, m.outputViewport.View())

	return style.Render(content)
}

func (m Model) renderStatusBar() string {
	var statusText string

	if m.processDone {
		statusText = ProgressBarFilled.Render("✓ All stories complete!")
	} else if m.processRunning {
		story := GetStoryByID(m.stories, m.currentStoryID)
		if story != nil {
			elapsed := formatElapsed(m.iterationStart)
			statusText = fmt.Sprintf("▸ %s: %s    %s", story.ID, story.Title, TimerStyle.Render("⏱ "+elapsed))
		} else {
			statusText = "Running..."
		}
	} else if m.processError != nil {
		statusText = lipgloss.NewStyle().Foreground(Red).Render("Error: " + m.processError.Error())
	} else {
		statusText = HelpStyle.Render("Press 'r' to start")
	}

	if len(statusText) > m.width-4 {
		statusText = statusText[:m.width-7] + "..."
	}

	return StatusBarStyle.Width(m.width).Render(statusText)
}

func formatElapsed(start time.Time) string {
	elapsed := time.Since(start)
	minutes := int(elapsed.Minutes())
	seconds := int(elapsed.Seconds()) % 60
	return fmt.Sprintf("%dm %02ds", minutes, seconds)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
