package utils

import (
	"sort"
)

type Number interface {
	int64 | int | float64 | float32
}

func Median[T Number](data []T) T {
	dataCopy := make([]T, len(data))
	copy(dataCopy, data)
	sort.Slice(dataCopy, func(i, j int) bool {
		return dataCopy[i] < dataCopy[j]
	})

	n := len(dataCopy)
	if n%2 == 0 {
		return (dataCopy[n/2-1] + dataCopy[n/2]) / 2
	}
	return dataCopy[n/2]
}

func MaxSlice[T Number](slice []T) T {
	if len(slice) == 0 {
		panic("empty slice")
	}
	max := slice[0]
	for _, value := range slice[1:] {
		if value > max {
			max = value
		}
	}
	return max
}

func MinSlice[T Number](slice []T) T {
	if len(slice) == 0 {
		panic("empty slice")
	}
	min := slice[0]
	for _, value := range slice[1:] {
		if value < min {
			min = value
		}
	}
	return min
}
