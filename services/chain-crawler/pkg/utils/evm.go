package utils

func EventTopicToAddress(topic string) string {
	return "0x" + topic[len(topic)-40:]
}
