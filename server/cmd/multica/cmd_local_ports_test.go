package main

import "testing"

func TestConfigLocalDefaultPorts(t *testing.T) {
	t.Parallel()

	port, err := configLocalCmd.Flags().GetInt("port")
	if err != nil {
		t.Fatalf("GetInt(port) returned error: %v", err)
	}
	if port != 22201 {
		t.Fatalf("config local default port = %d, want %d", port, 22201)
	}

	frontendPort, err := configLocalCmd.Flags().GetInt("frontend-port")
	if err != nil {
		t.Fatalf("GetInt(frontend-port) returned error: %v", err)
	}
	if frontendPort != 22202 {
		t.Fatalf("config local default frontend-port = %d, want %d", frontendPort, 22202)
	}
}

func TestSetupDefaultLocalPorts(t *testing.T) {
	t.Parallel()

	port, err := setupCmd.Flags().GetInt("port")
	if err != nil {
		t.Fatalf("GetInt(port) returned error: %v", err)
	}
	if port != 22201 {
		t.Fatalf("setup default port = %d, want %d", port, 22201)
	}

	frontendPort, err := setupCmd.Flags().GetInt("frontend-port")
	if err != nil {
		t.Fatalf("GetInt(frontend-port) returned error: %v", err)
	}
	if frontendPort != 22202 {
		t.Fatalf("setup default frontend-port = %d, want %d", frontendPort, 22202)
	}
}
