package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/fsnotify/fsnotify"
)

type PRDUpdatedMsg struct {
	PRD PRD
	Err error
}

type OutputLineMsg struct {
	Line      string
	Timestamp time.Time
}

type ProcessStartedMsg struct {
	Iteration int
	StoryID   string
	Cmd       *exec.Cmd
}

type ProcessExitedMsg struct {
	ExitCode int
	Complete bool
	Err      error
}

type TickMsg time.Time

type ErrorMsg struct {
	Err error
}

func watchPRDCmd(path string) tea.Cmd {
	return func() tea.Msg {
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			return ErrorMsg{Err: err}
		}
		defer watcher.Close()

		if err := watcher.Add(path); err != nil {
			return ErrorMsg{Err: err}
		}

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return nil
				}
				if event.Op&fsnotify.Write == fsnotify.Write {
					prd, err := LoadPRD(path)
					return PRDUpdatedMsg{PRD: prd, Err: err}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return nil
				}
				return ErrorMsg{Err: err}
			}
		}
	}
}

func runIterationCmd(promptPath, projectRoot string, iteration int, storyID string, msgChan chan<- interface{}) tea.Cmd {
	return func() tea.Msg {
		promptContent, err := os.ReadFile(promptPath)
		if err != nil {
			return ProcessExitedMsg{ExitCode: 1, Complete: false, Err: err}
		}

		// Check if current story needs ultrawork mode
		prdPath := filepath.Join(filepath.Dir(promptPath), "prd.json")
		prd, _ := LoadPRD(prdPath)
		story := GetStoryByID(prd.UserStories, storyID)

		if story != nil && story.Ultrawork {
			wrappedPrompt := "<ultrawork>\n" + string(promptContent) + "\n</ultrawork>"
			promptContent = []byte(wrappedPrompt)
		}

		cmd := exec.Command("opencode", "run", string(promptContent))
		cmd.Dir = projectRoot

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return ProcessExitedMsg{ExitCode: 1, Complete: false, Err: err}
		}

		stderr, err := cmd.StderrPipe()
		if err != nil {
			return ProcessExitedMsg{ExitCode: 1, Complete: false, Err: err}
		}

		if err := cmd.Start(); err != nil {
			return ProcessExitedMsg{ExitCode: 1, Complete: false, Err: err}
		}

		msgChan <- ProcessStartedMsg{
			Iteration: iteration,
			StoryID:   storyID,
			Cmd:       cmd,
		}

		go streamOutput(stdout, msgChan)
		go streamOutput(stderr, msgChan)

		err = cmd.Wait()
		exitCode := 0
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = 1
			}
		}

		return ProcessExitedMsg{
			ExitCode: exitCode,
			Complete: false,
			Err:      nil,
		}
	}
}

func streamOutput(reader io.Reader, msgChan chan<- interface{}) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		msgChan <- OutputLineMsg{
			Line:      line,
			Timestamp: time.Now(),
		}
	}
}

func listenForOutputCmd(msgChan <-chan interface{}) tea.Cmd {
	return func() tea.Msg {
		msg := <-msgChan
		return msg
	}
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

var storyPatterns = []*regexp.Regexp{
	regexp.MustCompile(`Working on (S\d+)`),
	regexp.MustCompile(`Next story: (S\d+)`),
	regexp.MustCompile(`feat: (S\d+)`),
	regexp.MustCompile(`\[(S\d+)\]`),
}

func parseStoryFromLine(line string) (storyID string, found bool) {
	for _, pattern := range storyPatterns {
		if matches := pattern.FindStringSubmatch(line); len(matches) > 1 {
			return matches[1], true
		}
	}
	return "", false
}

func checkCompleteSignal(line string) bool {
	return strings.Contains(line, "<promise>COMPLETE</promise>")
}

func formatTimestamp(t time.Time) string {
	return fmt.Sprintf("[%s]", t.Format("15:04:05"))
}
