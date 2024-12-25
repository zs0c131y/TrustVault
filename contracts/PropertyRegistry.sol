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
    }
    
    // Mapping from blockchain ID (address) to Property
    mapping(address => Property) public properties;
    
    // Event emitted when new property is registered
    event PropertyRegistered(
        address indexed blockchainId,
        string propertyId,
        string propertyName,
        address owner
    );
    
    // Event emitted when property is verified
    event PropertyVerified(address indexed blockchainId);
    
    // Function to register new property
    function registerProperty(
        string memory _propertyId,
        string memory _propertyName,
        string memory _location,
        string memory _propertyType
    ) public returns (address) {
        // Generate a unique blockchain ID based on property details
        address blockchainId = address(uint160(uint(keccak256(abi.encodePacked(_propertyId, block.timestamp)))));
        
        // Create new property
        properties[blockchainId] = Property({
            propertyId: _propertyId,
            propertyName: _propertyName,
            location: _location,
            propertyType: _propertyType,
            owner: msg.sender,
            registrationDate: block.timestamp,
            isVerified: false
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
    
    // Function to get property details
    function getProperty(address _blockchainId) public view returns (Property memory) {
        require(properties[_blockchainId].owner != address(0), "Property does not exist");
        return properties[_blockchainId];
    }
}