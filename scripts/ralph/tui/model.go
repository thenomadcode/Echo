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
	storyStartTimes  map[string]time.Time
	storyDurations   map[string]time.Duration

	processRunning bool
	processDone    bool
	processError   error
	initError      error
	runningCmd     *exec.Cmd

	outputLines       []string
	outputViewport    viewport.Model
	storyScroll       int
	showHelp          bool
	searchMode        bool
	searchQuery       string
	prdUpdateNotif    string
	prdUpdateNotifEnd time.Time

	width  int
	height int

	focusedPanel Panel

	prdPath     string
	promptPath  string
	projectRoot string

	msgChan chan interface{}
}

func NewModel(prdPath, promptPath, projectRoot string, maxIterations int) Model {
	prd, err := LoadPRD(prdPath)

	m := Model{
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
		initError:        err,
		storyStartTimes:  make(map[string]time.Time),
		storyDurations:   make(map[string]time.Duration),
	}

	if err != nil {
		m.outputLines = append(m.outputLines, "ERROR: Failed to load PRD file: "+err.Error())
		m.outputLines = append(m.outputLines, "Path: "+prdPath)
		m.outputViewport.SetContent(string(m.outputLines[0]) + "\n" + m.outputLines[1])
	}

	return m
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		watchPRDCmd(m.prdPath),
		tickCmd(),
	)
}
