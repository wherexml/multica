package assert

import (
	"fmt"
	"reflect"
	"strings"
)

type TestingT interface {
	Helper()
	Errorf(format string, args ...any)
}

func Equal(t TestingT, expected, actual any, msgAndArgs ...any) bool {
	t.Helper()
	if reflect.DeepEqual(expected, actual) {
		return true
	}

	fail(t, "Not equal: expected %#v, actual %#v%s", expected, actual, formatMessage(msgAndArgs))
	return false
}

func NotNil(t TestingT, object any, msgAndArgs ...any) bool {
	t.Helper()
	if !isNil(object) {
		return true
	}

	fail(t, "Expected value to be non-nil%s", formatMessage(msgAndArgs))
	return false
}

func NotEmpty(t TestingT, object any, msgAndArgs ...any) bool {
	t.Helper()
	if !isEmpty(object) {
		return true
	}

	fail(t, "Expected value to be non-empty%s", formatMessage(msgAndArgs))
	return false
}

func Contains(t TestingT, collection, contains any, msgAndArgs ...any) bool {
	t.Helper()

	switch value := collection.(type) {
	case string:
		substr, ok := contains.(string)
		if ok && strings.Contains(value, substr) {
			return true
		}
	default:
		rv := reflect.ValueOf(collection)
		switch rv.Kind() {
		case reflect.Array, reflect.Slice:
			for i := 0; i < rv.Len(); i++ {
				if reflect.DeepEqual(rv.Index(i).Interface(), contains) {
					return true
				}
			}
		case reflect.Map:
			key := reflect.ValueOf(contains)
			if key.IsValid() && rv.MapIndex(key).IsValid() {
				return true
			}
		}
	}

	fail(t, "Expected %#v to contain %#v%s", collection, contains, formatMessage(msgAndArgs))
	return false
}

func Len(t TestingT, object any, length int, msgAndArgs ...any) bool {
	t.Helper()

	rv := reflect.ValueOf(object)
	if !rv.IsValid() {
		fail(t, "Expected length %d, but value was invalid%s", length, formatMessage(msgAndArgs))
		return false
	}

	switch rv.Kind() {
	case reflect.Array, reflect.Chan, reflect.Map, reflect.Slice, reflect.String:
		if rv.Len() == length {
			return true
		}
		fail(t, "Expected length %d, actual %d%s", length, rv.Len(), formatMessage(msgAndArgs))
		return false
	default:
		fail(t, "Length assertion requires array, chan, map, slice, or string%s", formatMessage(msgAndArgs))
		return false
	}
}

func fail(t TestingT, format string, args ...any) {
	t.Helper()
	t.Errorf(format, args...)
}

func formatMessage(msgAndArgs []any) string {
	if len(msgAndArgs) == 0 {
		return ""
	}
	return ": " + fmt.Sprint(msgAndArgs...)
}

func isNil(object any) bool {
	if object == nil {
		return true
	}

	rv := reflect.ValueOf(object)
	switch rv.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Pointer, reflect.Slice:
		return rv.IsNil()
	default:
		return false
	}
}

func isEmpty(object any) bool {
	if isNil(object) {
		return true
	}

	rv := reflect.ValueOf(object)
	switch rv.Kind() {
	case reflect.Array, reflect.Chan, reflect.Map, reflect.Slice, reflect.String:
		return rv.Len() == 0
	case reflect.Bool:
		return !rv.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return rv.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return rv.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return rv.Float() == 0
	case reflect.Interface, reflect.Pointer:
		return rv.IsNil()
	case reflect.Struct:
		return reflect.DeepEqual(object, reflect.Zero(rv.Type()).Interface())
	default:
		return reflect.DeepEqual(object, reflect.Zero(rv.Type()).Interface())
	}
}
