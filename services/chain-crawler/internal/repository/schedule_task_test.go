package repository

import (
	"context"
	"strings"
	"testing"

	"chain_crawler/pkg/utils"

	"github.com/stretchr/testify/assert"
)

func TestTask(t *testing.T) {
	ctx := context.Background()
	task := ScheduleTask{
		Task:  "test_task",
		State: TaskStatePending,
		Data:  "test_data",
	}

	// test create success
	id, err := repositoryIns.CreateTask(ctx, task)
	assert.NoError(t, err)
	assert.NotEqual(t, uint(0), id)

	// test create failed
	id, err = repositoryIns.CreateTask(ctx, task)
	assert.Truef(t, err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed"), "expect error %+v", err)
	assert.Equal(t, uint(0), id)

	// test query
	if tasks, err := repositoryIns.QueryTask(context.Background(), QueryTaskParams{
		Task: task.Task,
		StateList: []TaskState{
			TaskStatePending,
		},
	}); err != nil {
		t.Fatalf("Query error %+v", err)
	} else if len(tasks) != 1 {
		t.Fatalf("tasks error %+v", tasks)
	} else {
		task.ID = tasks[0].ID
		task.CreatedAt = tasks[0].CreatedAt
		task.UpdatedAt = tasks[0].UpdatedAt
		originByte, _ := utils.JsonEncode(task)
		dbByte, _ := utils.JsonEncode(tasks[0])
		if string(originByte) != string(dbByte) {
			t.Fatalf("%+v != %+v", string(originByte), string(dbByte))
		}
	}
	if tasks, err := repositoryIns.QueryTask(context.Background(), QueryTaskParams{
		Task: task.Task,
		StateList: []TaskState{
			TaskStateDone,
		},
	}); err != nil {
		t.Fatalf("Query error %+v", err)
	} else if len(tasks) != 0 {
		t.Fatalf("tasks error %+v", tasks)
	}

	// test update
	task.State = TaskStateDone
	affected, err := repositoryIns.UpdateTask(ctx, task)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), affected)

	// test query
	if tasks, err := repositoryIns.QueryTask(context.Background(), QueryTaskParams{
		Task: task.Task,
		StateList: []TaskState{
			TaskStatePending,
			TaskStateDone,
		},
	}); err != nil {
		t.Fatalf("Query error %+v", err)
	} else if len(tasks) != 1 {
		t.Fatalf("tasks error %+v", tasks)
	} else {
		task.ID = tasks[0].ID
		task.CreatedAt = tasks[0].CreatedAt
		task.UpdatedAt = tasks[0].UpdatedAt
		originByte, _ := utils.JsonEncode(task)
		dbByte, _ := utils.JsonEncode(tasks[0])
		if string(originByte) != string(dbByte) {
			t.Fatalf("%+v != %+v", string(originByte), string(dbByte))
		}
	}
	if tasks, err := repositoryIns.QueryTask(context.Background(), QueryTaskParams{
		Task: task.Task,
		StateList: []TaskState{
			TaskStatePending,
		},
	}); err != nil {
		t.Fatalf("Query error %+v", err)
	} else if len(tasks) != 0 {
		t.Fatalf("tasks error %+v", tasks)
	}

	// test update
	oldState := task.State
	task.State = TaskStateFailed
	affected, err = repositoryIns.UpdateTaskWithState(ctx, task, oldState)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), affected)

	// test query
	if tasks, err := repositoryIns.QueryTask(context.Background(), QueryTaskParams{
		Task: task.Task,
		StateList: []TaskState{
			TaskStateFailed,
		},
	}); err != nil {
		t.Fatalf("Query error %+v", err)
	} else if len(tasks) != 1 {
		t.Fatalf("tasks error %+v", tasks)
	} else {
		task.ID = tasks[0].ID
		task.CreatedAt = tasks[0].CreatedAt
		task.UpdatedAt = tasks[0].UpdatedAt
		originByte, _ := utils.JsonEncode(task)
		dbByte, _ := utils.JsonEncode(tasks[0])
		if string(originByte) != string(dbByte) {
			t.Fatalf("%+v != %+v", string(originByte), string(dbByte))
		}
	}
}
