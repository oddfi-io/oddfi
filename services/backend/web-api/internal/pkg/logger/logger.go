package logger

import (
	"io"
	"os"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

var (
	log      zerolog.Logger
	initOnce sync.Once
)

func Init(level string, pretty bool) {
	initOnce.Do(func() {
		var output io.Writer = os.Stdout

		if pretty {
			output = zerolog.ConsoleWriter{
				Out:        os.Stdout,
				TimeFormat: time.RFC3339,
			}
		}

		lvl, err := zerolog.ParseLevel(level)
		if err != nil {
			lvl = zerolog.InfoLevel
		}

		log = zerolog.New(output).
			Level(lvl).
			With().
			Timestamp().
			Caller().
			Logger()
	})
}

func GetLogger() *zerolog.Logger {
	return &log
}

func Info(v ...interface{}) {
	log.Info().Msgf("%v", v...)
}

func Infof(format string, v ...interface{}) {
	log.Info().Msgf(format, v...)
}

func Warn(v ...interface{}) {
	log.Warn().Msgf("%v", v...)
}

func Warnf(format string, v ...interface{}) {
	log.Warn().Msgf(format, v...)
}

func Error(v ...interface{}) {
	log.Error().Msgf("%v", v...)
}

func Errorf(format string, v ...interface{}) {
	log.Error().Msgf(format, v...)
}

func Debug(v ...interface{}) {
	log.Debug().Msgf("%v", v...)
}

func Debugf(format string, v ...interface{}) {
	log.Debug().Msgf(format, v...)
}

func Fatal(v ...interface{}) {
	log.Fatal().Msgf("%v", v...)
}

func Fatalf(format string, v ...interface{}) {
	log.Fatal().Msgf(format, v...)
}
