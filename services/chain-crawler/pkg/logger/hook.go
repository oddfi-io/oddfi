package logger

import (
	"go.uber.org/multierr"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var _ zapcore.Core = (*EntryHookCore)(nil)

type HookFunc func(zapcore.Entry, []zap.Field) error

type EntryHookCore struct {
	zapcore.Core
	funcs []HookFunc
}

func RegisterHooks(core zapcore.Core, hooks ...HookFunc) zapcore.Core {
	funcs := append([]HookFunc{}, hooks...)
	return &EntryHookCore{
		Core:  core,
		funcs: funcs,
	}
}

func (e *EntryHookCore) Level() zapcore.Level {
	return zapcore.LevelOf(e.Core)
}

func (e *EntryHookCore) Check(ent zapcore.Entry, ce *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	if downstream := e.Core.Check(ent, ce); downstream != nil {
		return downstream.AddCore(ent, e)
	}
	return ce
}

func (e *EntryHookCore) With(fields []zapcore.Field) zapcore.Core {
	return &EntryHookCore{
		Core:  e.Core.With(fields),
		funcs: e.funcs,
	}
}

func (e *EntryHookCore) Write(entry zapcore.Entry, fields []zap.Field) error {
	var err error
	for i := range e.funcs {
		err = multierr.Append(err, e.funcs[i](entry, fields))
	}
	return err
}
