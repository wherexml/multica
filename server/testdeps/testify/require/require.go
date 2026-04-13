package require

import (
	"fmt"

	"github.com/stretchr/testify/assert"
)

type TestingT interface {
	Helper()
	Errorf(format string, args ...any)
	FailNow()
}

func Equal(t TestingT, expected, actual any, msgAndArgs ...any) {
	t.Helper()
	if !assert.Equal(t, expected, actual, msgAndArgs...) {
		t.FailNow()
	}
}

func NotEmpty(t TestingT, object any, msgAndArgs ...any) {
	t.Helper()
	if !assert.NotEmpty(t, object, msgAndArgs...) {
		t.FailNow()
	}
}

func NotNil(t TestingT, object any, msgAndArgs ...any) {
	t.Helper()
	if !assert.NotNil(t, object, msgAndArgs...) {
		t.FailNow()
	}
}

func Len(t TestingT, object any, length int, msgAndArgs ...any) {
	t.Helper()
	if !assert.Len(t, object, length, msgAndArgs...) {
		t.FailNow()
	}
}

func Failf(t TestingT, failureMessage string, format string, args ...any) {
	t.Helper()
	t.Errorf("%s: %s", failureMessage, fmt.Sprintf(format, args...))
	t.FailNow()
}
