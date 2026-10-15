#!/bin/bash

# 部署脚本
# 用途：支持不同环境的自动化部署
# 使用方法：./scripts/deploy.sh [环境] [操作类型]

set -e

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_NAME="chain_crawler"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
Chain Crawler 部署脚本

用法:
    $0 [环境] [操作类型] [选项]

环境:
    local   - 本地开发环境
    dev     - 开发环境
    test    - 测试环境
    pre     - 预生产环境
    prod    - 生产环境

操作类型:
    build   - 构建应用程序
    deploy  - 部署应用程序
    restart - 重启应用程序
    stop    - 停止应用程序
    status  - 查看应用状态
    logs    - 查看应用日志

选项:
    -f, --force         强制操作
    -s, --skip-tests    跳过测试
    -h, --help          显示帮助信息

示例:
    $0 dev build                    # 构建开发环境
    $0 test deploy --skip-tests     # 部署测试环境，跳过测试
    $0 prod deploy --force          # 强制部署生产环境
    $0 local status                 # 查看本地环境状态

EOF
}

# 解析命令行参数
parse_args() {
    ENVIRONMENT=""
    ACTION=""
    FORCE=false
    SKIP_TESTS=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            local|dev|test|pre|prod)
                ENVIRONMENT="$1"
                shift
                ;;
            build|deploy|restart|stop|status|logs)
                ACTION="$1"
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 验证必需参数
    if [[ -z "$ENVIRONMENT" ]]; then
        log_error "必须指定环境"
        show_help
        exit 1
    fi

    if [[ -z "$ACTION" ]]; then
        log_error "必须指定操作类型"
        show_help
        exit 1
    fi
}

# 验证环境
validate_environment() {
    local config_file="${PROJECT_ROOT}/configs/chaincrawler.${ENVIRONMENT}.toml"
    
    if [[ ! -f "$config_file" ]]; then
        log_error "配置文件不存在: $config_file"
        exit 1
    fi

    log_info "使用配置文件: $config_file"
    
    # 生产环境额外确认
    if [[ "$ENVIRONMENT" == "prod" && "$FORCE" != true ]]; then
        echo
        log_warning "⚠️  您即将在生产环境执行操作: $ACTION"
        read -p "确认继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "操作已取消"
            exit 0
        fi
    fi
}

# 设置环境变量
setup_environment() {
    export APP_ENV="$ENVIRONMENT"
    export CONFIG_FILE="configs/chaincrawler.${ENVIRONMENT}.toml"
    
    log_info "环境设置完成:"
    log_info "  - APP_ENV: $APP_ENV"
    log_info "  - CONFIG_FILE: $CONFIG_FILE"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    # 检查Go
    if ! command -v go &> /dev/null; then
        log_error "Go 未安装"
        exit 1
    fi
    
    # 检查Docker (如果需要)
    if [[ "$ACTION" == "deploy" && "$ENVIRONMENT" != "local" ]]; then
        if ! command -v docker &> /dev/null; then
            log_error "Docker 未安装"
            exit 1
        fi
    fi
    
    # 检查kubectl (如果需要)
    if [[ "$ACTION" == "deploy" && "$ENVIRONMENT" != "local" ]]; then
        if ! command -v kubectl &> /dev/null; then
            log_warning "kubectl 未安装，将跳过Kubernetes部署"
        fi
    fi
    
    log_success "依赖检查完成"
}

# 运行测试
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "跳过测试"
        return 0
    fi
    
    log_info "运行测试..."
    cd "$PROJECT_ROOT"
    
    make test || {
        log_error "测试失败"
        exit 1
    }
    
    log_success "测试通过"
}

# 构建应用程序
build_app() {
    log_info "构建应用程序 (环境: $ENVIRONMENT)..."
    cd "$PROJECT_ROOT"
    
    # 清理旧的构建产物
    make clean
    
    # 构建
    if [[ "$ENVIRONMENT" == "local" ]]; then
        make build
    else
        ENV="$ENVIRONMENT" make build-env
    fi
    
    log_success "构建完成"
}

# 本地部署
deploy_local() {
    log_info "本地部署..."
    
    # 停止现有进程
    pkill -f "chain_crawler" || true
    
    # 启动应用
    cd "$PROJECT_ROOT"
    nohup ./build/chain_crawler > logs/app.log 2>&1 &
    
    # 等待启动
    sleep 3
    
    # 健康检查
    if curl -f -s http://localhost:8080/health > /dev/null; then
        log_success "本地部署成功"
    else
        log_error "本地部署失败"
        exit 1
    fi
}

# Docker部署
deploy_docker() {
    log_info "Docker部署 (环境: $ENVIRONMENT)..."
    cd "$PROJECT_ROOT"
    
    # 构建Docker镜像
    docker build -t "${APP_NAME}:${ENVIRONMENT}" .
    
    # 停止现有容器
    docker stop "${APP_NAME}-${ENVIRONMENT}" 2>/dev/null || true
    docker rm "${APP_NAME}-${ENVIRONMENT}" 2>/dev/null || true
    
    # 启动新容器
    docker run -d \
        --name "${APP_NAME}-${ENVIRONMENT}" \
        -p 8080:8080 \
        -e APP_ENV="$ENVIRONMENT" \
        "${APP_NAME}:${ENVIRONMENT}"
    
    # 等待启动
    sleep 5
    
    # 健康检查
    if curl -f -s http://localhost:8080/health > /dev/null; then
        log_success "Docker部署成功"
    else
        log_error "Docker部署失败"
        exit 1
    fi
}

# Kubernetes部署
deploy_k8s() {
    log_info "Kubernetes部署 (环境: $ENVIRONMENT)..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl 未安装"
        exit 1
    fi
    
    # 更新部署
    kubectl set image deployment/${APP_NAME} \
        ${APP_NAME}=${APP_NAME}:${ENVIRONMENT} \
        -n chain-crawler-${ENVIRONMENT}
    
    # 等待部署完成
    kubectl rollout status deployment/${APP_NAME} \
        -n chain-crawler-${ENVIRONMENT} \
        --timeout=300s
    
    log_success "Kubernetes部署成功"
}

# 部署应用
deploy_app() {
    case "$ENVIRONMENT" in
        local)
            deploy_local
            ;;
        *)
            if command -v kubectl &> /dev/null; then
                deploy_k8s
            else
                deploy_docker
            fi
            ;;
    esac
}

# 重启应用
restart_app() {
    log_info "重启应用 (环境: $ENVIRONMENT)..."
    
    case "$ENVIRONMENT" in
        local)
            pkill -f "chain_crawler" || true
            sleep 2
            deploy_local
            ;;
        *)
            if command -v kubectl &> /dev/null; then
                kubectl rollout restart deployment/${APP_NAME} -n chain-crawler-${ENVIRONMENT}
                kubectl rollout status deployment/${APP_NAME} -n chain-crawler-${ENVIRONMENT}
            else
                docker restart "${APP_NAME}-${ENVIRONMENT}"
            fi
            ;;
    esac
    
    log_success "重启完成"
}

# 停止应用
stop_app() {
    log_info "停止应用 (环境: $ENVIRONMENT)..."
    
    case "$ENVIRONMENT" in
        local)
            pkill -f "chain_crawler" || true
            ;;
        *)
            if command -v kubectl &> /dev/null; then
                kubectl scale deployment ${APP_NAME} --replicas=0 -n chain-crawler-${ENVIRONMENT}
            else
                docker stop "${APP_NAME}-${ENVIRONMENT}" || true
            fi
            ;;
    esac
    
    log_success "停止完成"
}

# 查看应用状态
show_status() {
    log_info "查看应用状态 (环境: $ENVIRONMENT)..."
    
    case "$ENVIRONMENT" in
        local)
            if pgrep -f "chain_crawler" > /dev/null; then
                log_success "应用正在运行"
                curl -s http://localhost:8080/health | jq . || echo "健康检查失败"
            else
                log_warning "应用未运行"
            fi
            ;;
        *)
            if command -v kubectl &> /dev/null; then
                kubectl get pods -n chain-crawler-${ENVIRONMENT} -l app=${APP_NAME}
                kubectl get service -n chain-crawler-${ENVIRONMENT} -l app=${APP_NAME}
            else
                docker ps -f name="${APP_NAME}-${ENVIRONMENT}"
            fi
            ;;
    esac
}

# 查看应用日志
show_logs() {
    log_info "查看应用日志 (环境: $ENVIRONMENT)..."
    
    case "$ENVIRONMENT" in
        local)
            if [[ -f "${PROJECT_ROOT}/logs/app.log" ]]; then
                tail -f "${PROJECT_ROOT}/logs/app.log"
            else
                log_warning "日志文件不存在"
            fi
            ;;
        *)
            if command -v kubectl &> /dev/null; then
                kubectl logs -f deployment/${APP_NAME} -n chain-crawler-${ENVIRONMENT}
            else
                docker logs -f "${APP_NAME}-${ENVIRONMENT}"
            fi
            ;;
    esac
}

# 主函数
main() {
    echo "==================================="
    echo "  Chain Crawler 部署脚本"
    echo "==================================="
    echo
    
    parse_args "$@"
    validate_environment
    setup_environment
    check_dependencies
    
    case "$ACTION" in
        build)
            run_tests
            build_app
            ;;
        deploy)
            run_tests
            build_app
            deploy_app
            ;;
        restart)
            restart_app
            ;;
        stop)
            stop_app
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        *)
            log_error "未知操作: $ACTION"
            show_help
            exit 1
            ;;
    esac
    
    echo
    log_success "操作完成!"
}

# 执行主函数
main "$@" 