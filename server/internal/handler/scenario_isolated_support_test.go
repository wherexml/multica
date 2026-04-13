//go:build scenarioisolated

package handler

type PingStore struct{}

func NewPingStore() *PingStore {
	return &PingStore{}
}

type UpdateStore struct{}

func NewUpdateStore() *UpdateStore {
	return &UpdateStore{}
}

func generateIssuePrefix(string) string {
	return "SCH"
}
