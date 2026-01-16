package main

import (
	"os/exec"
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
)

type Panel int

const (
	PanelStories Panel = iota
	PanelOutput
)

type Model struct {
	prd              PRD
	stories          []Story
	completedCount   int
	currentIteration int
	maxIterations    int
	currentStoryID   string
	iterationStart   time.Time

	processRunning bool
	processDone    bool
	processError   error
	runningCmd     *exec.Cmd

	outputLines    []string
	outputViewport viewport.Model
	storyScroll    int

	width  int
	height int

	focusedPanel Panel

	prdPath     string
	promptPath  string
	projectRoot string

	msgChan chan interface{}
}

func NewModel(prdPath, promptPath, projectRoot string, maxIterations int) Model {
	prd, _ := LoadPRD(prdPath)

	return Model{
		prd:              prd,
		stories:          prd.UserStories,
		completedCount:   CountCompleted(prd.UserStories),
		currentIteration: 0,
		maxIterations:    maxIterations,
		outputLines:      []string{},
		outputViewport:   viewport.New(80, 20),
		focusedPanel:     PanelOutput,
		prdPath:          prdPath,
		promptPath:       promptPath,
		projectRoot:      projectRoot,
		msgChan:          make(chan interface{}, 100),
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		watchPRDCmd(m.prdPath),
		tickCmd(),
	)
}
