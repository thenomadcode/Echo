package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

const (
	headerHeight         = 5
	progressHeight       = 5
	statusBarHeight      = 2
	totalUIOverhead      = headerHeight + progressHeight + statusBarHeight
	minPanelHeight       = 5
	minProgressBarWidth  = 20
	progressBarPadding   = 30
	panelHorizontalPad   = 2
	panelGap             = 4
	storyIDWidth         = 9
	minTitleWidth        = 10
	storiesPanelTitlePad = 3
)

func (m Model) View() string {
	if m.width == 0 || m.height == 0 {
		return "Loading..."
	}

	if m.showHelp {
		return m.renderHelpScreen()
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

func (m Model) renderHelpScreen() string {
	helpStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(Purple).
		Padding(2, 4).
		Width(m.width - 10).
		Height(m.height - 6)

	helpText := []string{
		HeaderStyle.Render(" Ralph - Keyboard Shortcuts "),
		"",
		lipgloss.NewStyle().Bold(true).Render("Navigation:"),
		"  tab          Switch between Stories and Output panels",
		"  ↑/↓ or j/k   Scroll up/down in focused panel",
		"  g            Jump to top",
		"  G            Jump to bottom",
		"",
		lipgloss.NewStyle().Bold(true).Render("Control:"),
		"  r            Start/restart iteration",
		"  q or Ctrl+C  Quit application",
		"",
		lipgloss.NewStyle().Bold(true).Render("Search:"),
		"  /            Enter search mode (filter stories)",
		"  Esc          Exit search mode",
		"",
		lipgloss.NewStyle().Bold(true).Render("Help:"),
		"  ?            Toggle this help screen",
		"",
		"",
		HelpStyle.Render("Press ? or Esc to close"),
	}

	content := strings.Join(helpText, "\n")
	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, helpStyle.Render(content))
}

func (m Model) renderHeader() string {
	title := HeaderStyle.Render(" Ralph ")

	projectInfo := ""
	if m.prd.Project != "" {
		projectInfo = fmt.Sprintf("%s", m.prd.Project)
		if m.prd.BranchName != "" {
			projectInfo += fmt.Sprintf(" (%s)", m.prd.BranchName)
		}
	}

	iterationText := fmt.Sprintf("Iteration %d", m.currentIteration)
	if m.maxIterations > 0 {
		iterationText = fmt.Sprintf("Iteration %d/%d", m.currentIteration, m.maxIterations)
	}

	help := HelpStyle.Render("q: quit │ tab: switch panel │ r: restart")

	headerLine1 := lipgloss.JoinHorizontal(
		lipgloss.Center,
		title,
		strings.Repeat(" ", max(0, m.width-lipgloss.Width(title)-lipgloss.Width(iterationText)-lipgloss.Width(help)-4)),
		iterationText,
		"  ",
		help,
	)

	if projectInfo != "" {
		projectLine := HelpStyle.Render(projectInfo)
		if m.prd.Description != "" {
			descLine := HelpStyle.Render("  " + m.prd.Description)
			return lipgloss.JoinVertical(lipgloss.Left, headerLine1, projectLine, descLine)
		}
		return lipgloss.JoinVertical(lipgloss.Left, headerLine1, projectLine)
	}

	return headerLine1
}

func (m Model) renderProgress() string {
	total := len(m.stories)
	if total == 0 {
		return ""
	}

	percent := float64(m.completedCount) / float64(total)
	barWidth := m.width - progressBarPadding
	if barWidth < minProgressBarWidth {
		barWidth = minProgressBarWidth
	}

	filledWidth := int(float64(barWidth) * percent)
	emptyWidth := barWidth - filledWidth

	filled := ProgressBarFilled.Render(strings.Repeat("█", filledWidth))
	empty := ProgressBarEmpty.Render(strings.Repeat("░", emptyWidth))
	bar := filled + empty

	label := fmt.Sprintf("Progress: %d/%d stories", m.completedCount, total)
	percentText := fmt.Sprintf("%d%%", int(percent*100))

	statsText := m.renderProgressStats()

	line1 := "  " + label + statsText
	line2 := "  " + bar + "  " + percentText

	return lipgloss.JoinVertical(lipgloss.Left, "", line1, line2, "")
}

func (m Model) renderProgressStats() string {
	if len(m.storyDurations) == 0 {
		return ""
	}

	var totalDuration time.Duration
	var fastest, slowest time.Duration
	first := true
	for _, duration := range m.storyDurations {
		totalDuration += duration
		if first || duration < fastest {
			fastest = duration
		}
		if first || duration > slowest {
			slowest = duration
		}
		first = false
	}

	avgDuration := totalDuration / time.Duration(len(m.storyDurations))
	remaining := len(m.stories) - m.completedCount
	estimatedTime := time.Duration(remaining) * avgDuration

	stats := fmt.Sprintf(" │ Avg: %s │ Est: %s",
		formatDuration(avgDuration),
		formatDuration(estimatedTime))

	return HelpStyle.Render(stats)
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	minutes := int(d.Minutes())
	seconds := int(d.Seconds()) % 60
	if minutes < 60 {
		return fmt.Sprintf("%dm%ds", minutes, seconds)
	}
	hours := minutes / 60
	minutes = minutes % 60
	return fmt.Sprintf("%dh%dm", hours, minutes)
}

func (m Model) renderMainContent() string {
	panelHeight := m.height - totalUIOverhead
	if panelHeight < minPanelHeight {
		panelHeight = minPanelHeight
	}

	leftWidth := m.width/2 - panelHorizontalPad
	rightWidth := m.width - leftWidth - panelGap

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
	if m.searchMode {
		title = PanelTitleStyle.Render(fmt.Sprintf("Search: %s█", m.searchQuery))
	}

	displayStories := m.stories
	if m.searchQuery != "" {
		displayStories = m.filterStories()
	}

	var storyLines []string
	visibleCount := height - 3
	if visibleCount < 1 {
		visibleCount = 1
	}

	startIdx := m.storyScroll
	endIdx := startIdx + visibleCount
	if endIdx > len(displayStories) {
		endIdx = len(displayStories)
	}

	for i := startIdx; i < endIdx; i++ {
		story := displayStories[i]
		line := m.renderStoryLine(story, width-4)
		storyLines = append(storyLines, line)
	}

	scrollBar := ""
	if len(displayStories) > visibleCount {
		scrollIndicator := HelpStyle.Render(fmt.Sprintf("  ↑↓ to scroll (%d-%d of %d)", startIdx+1, endIdx, len(displayStories)))
		storyLines = append(storyLines, scrollIndicator)
		scrollBar = m.renderScrollBar(len(displayStories), visibleCount, startIdx, height-storiesPanelTitlePad)
	}

	storyListContent := strings.Join(storyLines, "\n")
	if scrollBar != "" {
		lines := strings.Split(storyListContent, "\n")
		scrollBarLines := strings.Split(scrollBar, "\n")

		var combined []string
		for i := 0; i < len(lines) && i < len(scrollBarLines); i++ {
			lineWidth := width - 5
			line := lines[i]
			if len(line) > lineWidth {
				line = line[:lineWidth]
			}
			combined = append(combined, line+strings.Repeat(" ", max(0, lineWidth-len(line)))+scrollBarLines[i])
		}
		for i := len(combined); i < len(lines); i++ {
			combined = append(combined, lines[i])
		}
		storyListContent = strings.Join(combined, "\n")
	}

	currentStory := GetStoryByID(m.stories, m.currentStoryID)
	if currentStory != nil && m.focusedPanel == PanelStories {
		detailLines := []string{"", PanelTitleStyle.Render("Current Story Details")}
		if currentStory.Description != "" {
			detailLines = append(detailLines, HelpStyle.Render("Description: "+currentStory.Description))
		}
		if len(currentStory.AcceptanceCriteria) > 0 {
			detailLines = append(detailLines, HelpStyle.Render("Acceptance Criteria:"))
			for _, criteria := range currentStory.AcceptanceCriteria {
				detailLines = append(detailLines, HelpStyle.Render("  • "+criteria))
			}
		}
		storyListContent = lipgloss.JoinVertical(lipgloss.Left, storyListContent, strings.Join(detailLines, "\n"))
	}

	content := lipgloss.JoinVertical(lipgloss.Left, title, storyListContent)

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

	criteriaCount := fmt.Sprintf("[%d]", len(story.AcceptanceCriteria))
	notesIcon := ""
	if story.Notes != "" {
		notesIcon = "📝 "
	}

	metaWidth := len(criteriaCount) + len(notesIcon) + 1
	titleMaxLen := maxWidth - storyIDWidth - metaWidth
	if titleMaxLen < minTitleWidth {
		titleMaxLen = minTitleWidth
	}

	title := story.Title
	if len(title) > titleMaxLen {
		title = title[:titleMaxLen-3] + "..."
	}

	mainLine := fmt.Sprintf("%s %s %s %s%s", statusIcon, story.ID, style.Render(title), notesIcon, HelpStyle.Render(criteriaCount))

	if story.Description != "" && !isCurrent {
		descMaxLen := maxWidth - 4
		desc := story.Description
		if len(desc) > descMaxLen {
			desc = desc[:descMaxLen-3] + "..."
		}
		return mainLine + "\n" + HelpStyle.Render("    "+desc)
	}

	return mainLine
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

	if m.prdUpdateNotif != "" {
		statusText = lipgloss.NewStyle().Foreground(Green).Render(m.prdUpdateNotif)
	} else if m.processDone {
		statusText = ProgressBarFilled.Render("✓ All stories complete!")
	} else if m.processRunning {
		story := GetStoryByID(m.stories, m.currentStoryID)
		if story != nil {
			elapsed := formatElapsed(m.iterationStart)
			statusText = fmt.Sprintf("▸ %s: %s    %s", story.ID, story.Title, TimerStyle.Render("⏱ "+elapsed))
			if story.Notes != "" {
				statusText += fmt.Sprintf(" │ %s", HelpStyle.Render(story.Notes))
			}
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

func (m Model) renderScrollBar(totalItems, visibleCount, scrollPos, height int) string {
	if totalItems <= visibleCount {
		return ""
	}

	scrollRatio := float64(scrollPos) / float64(totalItems-visibleCount)
	thumbPos := int(scrollRatio * float64(height-1))

	var bar []string
	for i := 0; i < height; i++ {
		if i == thumbPos {
			bar = append(bar, lipgloss.NewStyle().Foreground(Purple).Render("█"))
		} else {
			bar = append(bar, lipgloss.NewStyle().Foreground(DarkGray).Render("│"))
		}
	}

	return strings.Join(bar, "\n")
}

func (m Model) filterStories() []Story {
	if m.searchQuery == "" {
		return m.stories
	}

	var filtered []Story
	query := strings.ToLower(m.searchQuery)
	for _, story := range m.stories {
		if strings.Contains(strings.ToLower(story.ID), query) ||
			strings.Contains(strings.ToLower(story.Title), query) ||
			strings.Contains(strings.ToLower(story.Description), query) {
			filtered = append(filtered, story)
		}
	}
	return filtered
}
