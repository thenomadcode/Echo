package main

import (
	"fmt"
	"math"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	exePath, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting executable path: %v\n", err)
		os.Exit(1)
	}

	exeDir := filepath.Dir(exePath)

	prdPath := filepath.Join(exeDir, "prd.json")
	promptPath := filepath.Join(exeDir, "prompt.md")
	projectRoot := filepath.Dir(filepath.Dir(exeDir))

	if _, err := os.Stat(prdPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: prd.json not found at %s\n", prdPath)
		os.Exit(1)
	}

	prd, err := LoadPRD(prdPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading prd.json: %v\n", err)
		os.Exit(1)
	}

	pendingCount := CountPending(prd.UserStories)
	maxIterations := int(math.Ceil(float64(pendingCount) * 1.3))
	if maxIterations < 1 {
		maxIterations = 1
	}

	model := NewModel(prdPath, promptPath, projectRoot, maxIterations)

	p := tea.NewProgram(
		model,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running program: %v\n", err)
		os.Exit(1)
	}
}
