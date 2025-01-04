// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PropertyRegistry {
    struct Property {
        string propertyId;          // Original system property ID
        string propertyName;        // Name/title of the property
        string location;           // Property location
        string propertyType;       // Type of property
        address owner;             // Owner's ethereum address
        uint256 registrationDate;  // Registration timestamp
        bool isVerified;          // Verification status
        uint256 lastTransferDate; // Date of last ownership transfer
    }
    
    // Mapping from blockchain ID (address) to Property
    mapping(address => Property) public properties;
    mapping(string => address) public propertyIdToAddress;
    
    // Event emitted when new property is registered
    event PropertyRegistered(
        address indexed blockchainId,
        string propertyId,
        string propertyName,
        address owner
    );
    
    // Event emitted when property is verified
    event PropertyVerified(address indexed blockchainId);

    // Event emitted when property ownership is transferred
    event OwnershipTransferred(
        address indexed blockchainId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 transferDate
    );
    
    // Function to register new property
    function registerProperty(
    string memory _propertyId,
    string memory _propertyName,
    string memory _location,
    string memory _propertyType
) public returns (address) {
        // Generate a unique blockchain ID based on property details
        address blockchainId = address(uint160(uint(keccak256(abi.encodePacked(_propertyId, block.timestamp)))));
        propertyIdToAddress[_propertyId] = blockchainId;
        
        // Create new property
        properties[blockchainId] = Property({
            propertyId: _propertyId,
            propertyName: _propertyName,
            location: _location,
            propertyType: _propertyType,
            owner: msg.sender,
            registrationDate: block.timestamp,
            isVerified: false,
            lastTransferDate: block.timestamp
        });
        
        emit PropertyRegistered(blockchainId, _propertyId, _propertyName, msg.sender);
        return blockchainId;
    }
    
    // Function to verify property (only by authorized verifier)
    function verifyProperty(address _blockchainId) public {
        // Add proper authorization checks here
        require(properties[_blockchainId].owner != address(0), "Property does not exist");
        properties[_blockchainId].isVerified = true;
        emit PropertyVerified(_blockchainId);
    }
    
    // Function to transfer property ownership
    function transferOwnership(address _blockchainId, address _newOwner) public {
        require(properties[_blockchainId].owner != address(0), "Property does not exist");
        require(properties[_blockchainId].owner == msg.sender, "Only current owner can transfer property");
        require(_newOwner != address(0), "Invalid new owner address");
        require(properties[_blockchainId].isVerified, "Property must be verified before transfer");

        address previousOwner = properties[_blockchainId].owner;
        properties[_blockchainId].owner = _newOwner;
        properties[_blockchainId].lastTransferDate = block.timestamp;

        emit OwnershipTransferred(_blockchainId, previousOwner, _newOwner, block.timestamp);
    }
    
    // Function to get property details
    function getProperty(address _blockchainId) public view returns (Property memory) {
        require(properties[_blockchainId].owner != address(0), "Property does not exist");
        return properties[_blockchainId];
    }
}