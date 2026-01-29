package main

import (
	"encoding/json"
	"os"
	"sort"
)

// PRD represents the product requirements document
type PRD struct {
	ProjectName string  `json:"projectName"`
	BranchName  string  `json:"branchName"`
	UserStories []Story `json:"userStories"`
}

// Story represents a user story in the PRD
type Story struct {
	ID                 string   `json:"id"`
	Title              string   `json:"title"`
	Priority           int      `json:"priority"`
	Passes             bool     `json:"passes"`
	AcceptanceCriteria []string `json:"acceptanceCriteria"`
}

// LoadPRD reads and parses the PRD JSON file
func LoadPRD(path string) (PRD, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return PRD{}, err
	}

	var prd PRD
	if err := json.Unmarshal(data, &prd); err != nil {
		return PRD{}, err
	}

	sort.Slice(prd.UserStories, func(i, j int) bool {
		return prd.UserStories[i].Priority < prd.UserStories[j].Priority
	})

	return prd, nil
}

// CountCompleted returns the number of completed stories
func CountCompleted(stories []Story) int {
	count := 0
	for _, s := range stories {
		if s.Passes {
			count++
		}
	}
	return count
}

// CountPending returns the number of pending (incomplete) stories
func CountPending(stories []Story) int {
	return len(stories) - CountCompleted(stories)
}

// GetNextStory returns the next incomplete story by priority
func GetNextStory(stories []Story) *Story {
	for i := range stories {
		if !stories[i].Passes {
			return &stories[i]
		}
	}
	return nil
}

// GetStoryByID returns a story by its ID
func GetStoryByID(stories []Story, id string) *Story {
	for i := range stories {
		if stories[i].ID == id {
			return &stories[i]
		}
	}
	return nil
}
