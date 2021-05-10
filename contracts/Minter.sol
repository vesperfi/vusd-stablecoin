// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./interfaces/bloq/IAddressList.sol";
import "./interfaces/bloq/IAddressListFactory.sol";
import "./interfaces/IVirtualDollar.sol";

/// @title Minter contract which will mint DV 1:1, less minting fee, with DAI, USDC or USDT.
contract Minter is Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant NAME = "DV-Minter";
    string public constant VERSION = "1.0.0";

    IAddressList public immutable whitelistedTokens;
    IVirtualDollar public immutable virtualDollar;

    uint256 public constant MINT_LIMIT = 50_000_000 * 10**18; // 50M DV
    uint256 public mintingFee = 5; // 0.05%
    uint256 public constant MAX_MINTING_FEE = 10_000; // 10_000 = 100%

    event UpdatedMintingFee(uint256 previousMintingFee, uint256 newMintingFee);

    constructor(address _virtualDollar) {
        require(_virtualDollar != address(0), "virtual-dollar-address-is-zero");
        virtualDollar = IVirtualDollar(_virtualDollar);

        IAddressListFactory _factory = IAddressListFactory(0xded8217De022706A191eE7Ee0Dc9df1185Fb5dA3);
        IAddressList _whitelistedTokens = IAddressList(_factory.createList());
        _whitelistedTokens.add(0x6B175474E89094C44Da98b954EedeAC495271d0F); // DAI
        _whitelistedTokens.add(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // USDC
        _whitelistedTokens.add(0xdAC17F958D2ee523a2206206994597C13D831ec7); // USDT

        whitelistedTokens = _whitelistedTokens;
    }

    modifier onlyGovernor() {
        require(_msgSender() == virtualDollar.governor(), "caller-is-not-the-governor");
        _;
    }

    ////////////////////////////// Only Governor //////////////////////////////
    /**
     * @notice Add given token address to the list of whitelisted tokens.
     * @param _token address which we want to add in token list.
     */
    function addWhitelistedToken(address _token) external onlyGovernor {
        require(whitelistedTokens.add(_token), "add-in-list-failed");
    }

    /**
     * @notice Remove given address from he list of whitelisted tokens.
     * @param _token address which we want to remove from token list.
     */
    function removeWhitelistedToken(address _token) external onlyGovernor {
        require(whitelistedTokens.remove(_token), "remove-from-list-failed");
    }

    /// @notice Update minting fee
    function updateMintingFee(uint256 _newMintingFee) external onlyGovernor {
        require(_newMintingFee <= MAX_MINTING_FEE, "minting-fee-limit-reached");
        require(mintingFee != _newMintingFee, "same-minting-fee");
        emit UpdatedMintingFee(mintingFee, _newMintingFee);
        mintingFee = _newMintingFee;
    }

    ///////////////////////////////////////////////////////////////////////////

    /**
     * @notice Mint DV
     * @param _token Address of token being deposited
     * @param _amount Amount of _token
     */
    function mint(address _token, uint256 _amount) external nonReentrant {
        require(whitelistedTokens.contains(_token), "token-is-not-supported");
        uint256 _mintage = _calculateMintage(_token, _amount);
        require(availableMintage() >= _mintage, "mint-limit-reached");
        IERC20(_token).safeTransferFrom(_msgSender(), treasury(), _amount);
        virtualDollar.mint(_msgSender(), _mintage);
    }

    /**
     * @notice Calculate mintage for supported tokens.
     * @param _token Address of token which will be deposited for this mintage
     * @param _amount Amount of _token
     */
    function calculateMintage(address _token, uint256 _amount) external view returns (uint256 _mintReturn) {
        if (whitelistedTokens.contains(_token)) {
            uint256 _mintage = _calculateMintage(_token, _amount);
            return _mintage > availableMintage() ? 0 : _mintage;
        }
        // Return 0 for unsupported tokens.
        return 0;
    }

    /// @notice Check available mintage based on mint limit
    function availableMintage() public view returns (uint256 _mintage) {
        return MINT_LIMIT - virtualDollar.totalSupply();
    }

    /// @dev Treasury is defined in DV token contract only
    function treasury() public view returns (address) {
        return virtualDollar.treasury();
    }

    function _calculateMintage(address _token, uint256 _amount) internal view returns (uint256) {
        // Calculate minting fee
        uint256 _fee = (_amount * mintingFee) / MAX_MINTING_FEE;
        uint256 _decimals = IERC20Metadata(_token).decimals();
        // Convert final amount to 18 decimals
        return (_amount - _fee) * 10**(18 - _decimals);
    }
}
