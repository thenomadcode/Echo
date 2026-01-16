package main

import "github.com/charmbracelet/lipgloss"

var (
	Purple    = lipgloss.Color("#7C3AED")
	Green     = lipgloss.Color("#10B981")
	Yellow    = lipgloss.Color("#F59E0B")
	Red       = lipgloss.Color("#EF4444")
	Gray      = lipgloss.Color("#6B7280")
	DarkGray  = lipgloss.Color("#374151")
	LightGray = lipgloss.Color("#9CA3AF")
	White     = lipgloss.Color("#F9FAFB")
	BgDark    = lipgloss.Color("#111827")
	BgPanel   = lipgloss.Color("#1F2937")

	HeaderStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(White).
			Background(Purple).
			Padding(0, 1)

	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Purple)

	ProgressBarFilled = lipgloss.NewStyle().
				Foreground(Green)

	ProgressBarEmpty = lipgloss.NewStyle().
				Foreground(DarkGray)

	PanelStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(DarkGray).
			Padding(0, 1)

	PanelActiveStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(Purple).
				Padding(0, 1)

	PanelTitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(White).
			MarginBottom(1)

	StoryDoneStyle = lipgloss.NewStyle().
			Foreground(Gray)

	StoryCurrentStyle = lipgloss.NewStyle().
				Foreground(Yellow).
				Bold(true)

	StoryPendingStyle = lipgloss.NewStyle().
				Foreground(LightGray)

	StatusBarStyle = lipgloss.NewStyle().
			Foreground(LightGray).
			Background(BgPanel).
			Padding(0, 1)

	TimerStyle = lipgloss.NewStyle().
			Foreground(Yellow)

	HelpStyle = lipgloss.NewStyle().
			Foreground(Gray)

	LogTimestampStyle = lipgloss.NewStyle().
				Foreground(Gray)

	LogTextStyle = lipgloss.NewStyle().
			Foreground(LightGray)

	SuccessIcon = lipgloss.NewStyle().Foreground(Green).Render("✓")
	CurrentIcon = lipgloss.NewStyle().Foreground(Yellow).Render("▸")
	PendingIcon = lipgloss.NewStyle().Foreground(DarkGray).Render(" ")
	ErrorIcon   = lipgloss.NewStyle().Foreground(Red).Render("✗")
)
