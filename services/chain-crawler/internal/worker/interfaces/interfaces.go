package interfaces

type Worker interface {
	Run()
	Shutdown()
}

type ScheduleTask interface {
	Run()
	Shutdown()
	GetTaskName() string
}
