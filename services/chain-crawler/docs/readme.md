bsc 推送kafka格式见 ./bsc_push_kafka_msg.json
tron 推送kafka格式见 ./tron_push_kafka_msg.json

bsc改库扫描高度:
update schedule_task set data = '{"current_block":86908919,"parent_block_hash":""}' where task = 'forward_task_bsc';


tron改库扫描高度:
update schedule_task set data = '{"current_block":80996842,"parent_block_hash":""}' where task = 'full_forward_tron';