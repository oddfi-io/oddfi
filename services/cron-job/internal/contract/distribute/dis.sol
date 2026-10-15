// SPDX-License-Identifier: MIT
// address : 0x3cd84963954f8c6E4fbdE87B35B5638b545B6Ca9
pragma solidity ^0.8.20;

/**
 * @dev 简单的 ERC20 接口，用于合约调用转账函数
 */
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/**
 * @title TokenDistributor
 * @dev 专门用于批量分发代币的合约，仅限管理员操作
 */
contract TokenDistributor {
    address public owner;

    // 只有合约创建者可以调用
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    /**
     * @dev 构造函数：设置部署者为合约拥有者
     */
    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice 一次性将一种代币分发给多个地址
     * @param token 代币合约地址（如 Odd 代币地址）
     * @param recipients 接收者地址数组
     * @param amounts 对应的转账金额数组（需包含精度，如 18位0）
     */
    function batchDistribute(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        // 1. 基础校验
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        require(recipients.length < 101, "too many arrays");

        IERC20 erc20Token = IERC20(token);

        // 2. 循环转账
        for (uint256 i = 0; i < recipients.length; i++) {
            // 使用 transferFrom 将代币从你的钱包转给接收者
            // 这需要你预先对本合约地址进行 Approve 授权
            bool success = erc20Token.transferFrom(msg.sender, recipients[i], amounts[i]);
            require(success, "Transfer failed at index");
        }
    }

    /**
     * @dev 转移合约拥有权（可选）
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        owner = newOwner;
    }
}