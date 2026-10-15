// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error DependenciesNotConfigured();
error DependenciesAlreadyConfigured();
error InvalidBps(uint256 provided, uint256 maximum);
error InvalidRootAddressConfig(address platformRootAddress, address platformRootTaxReceiver);
error InvalidWhitelistConfig(address account);
error BatchSizeTooLarge(uint256 provided, uint256 hardCap);
