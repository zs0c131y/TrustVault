# TrustVault 🏢

A blockchain-based solution for modernizing land registry and document verification systems. TrustVault provides a secure, transparent, and efficient platform for managing property records and verifying important documents using blockchain technology.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18.x-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.x-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.x-green.svg)](https://www.mongodb.com/)
[![Web3.js](https://img.shields.io/badge/Web3.js-v1.x-orange.svg)](https://web3js.readthedocs.io/)

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- **Blockchain-Based Land Registry**
  - Digitized property records
  - Immutable transaction history
  - Smart contract integration
  - Double-selling prevention

- **Document Verification System**
  - Digital signatures
  - Multi-authority verification
  - Tamper-proof document storage
  - Instant verification process

- **User Management**
  - Secure authentication
  - Role-based access control
  - Profile management
  - Activity tracking

- **Security Features**
  - JWT authentication
  - Rate limiting
  - XSS protection
  - Input sanitization
  - Secure file uploads

## 🛠 Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript
- Web3.js
- MetaMask integration

### Backend
- Node.js
- Express.js
- MongoDB
- JWT authentication

### Blockchain
- Solidity
- Web3.js
- Hardhat/Truffle
- OpenZeppelin
- Ethereum Network

### Security
- Helmet.js
- Express Rate Limit
- XSS Protection
- CORS
- Input Validation

## 📁 Project Structure

```
trustvault/
├── middleware/       # Express middleware
├── node_modules/     # Project dependencies
├── public/           # Static files
├── uploads/          # Uploaded documents
├── .env              # Environment variables
├── config.js         # Configuration files
├── nodemon.json      # Nodemon configuration
├── package.json      # Project metadata
├── package-lock.json # Dependency lock file
└── server.js         # Main application file
```

## 📋 Prerequisites

Before running this project, make sure you have the following installed:

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- MetaMask browser extension
- Git

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/zs0c131y/trustvault.git
cd trustvault
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add necessary environment variables:
```env
PORT=3000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
NODE_ENV=development
BCRYPT_SALT_ROUNDS=12
```

4. Start the development server:
```bash
npm run dev
```

## ⚙️ Configuration

### Environment Variables

- `PORT`: Server port number
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `SESSION_SECRET`: Secret key for session management
- `NODE_ENV`: Application environment (development/production)

### MongoDB Setup

1. Create a MongoDB database
2. Update the `MONGO_URI` in your `.env` file
3. The application will automatically create required collections

### Blockchain Configuration

1. Install MetaMask browser extension
2. Configure MetaMask for the desired network (MainNet/TestNet)
3. Update blockchain network settings in `config.js`

## 💻 Usage

### Land Registry

1. Connect your MetaMask wallet
2. Navigate to the Land Registry service
3. Submit property documentation
4. Complete blockchain verification
5. Receive digital ownership certificate

### Document Verification

1. Upload documents for verification
2. Select verification authorities
3. Track verification status
4. Download verified documents

## 📚 API Documentation

### Authentication Endpoints

```
POST /login          # User login
POST /logout         # User logout
GET  /checkAuth      # Check authentication status
POST /refreshToken   # Refresh JWT token
```

### Property Endpoints

```
GET  /api/property/:pid          # Get property details
POST /api/register-property      # Register new property
```

### User Endpoints

```
POST /users          # Create/update user
GET  /getUserData    # Get user information
```

## 🔒 Security

TrustVault implements various security measures:

- JWT-based authentication
- Rate limiting for API endpoints
- XSS protection
- Input sanitization
- Secure file upload handling
- Session management
- CORS configuration
- Helmet.js security headers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🌟 Acknowledgments

- [OpenZeppelin](https://openzeppelin.com/) for smart contract libraries
- [Web3.js](https://web3js.readthedocs.io/) for blockchain integration
- [Express.js](https://expressjs.com/) for the backend framework
- [MongoDB](https://www.mongodb.com/) for the database

## 📞 Contact

For questions and support, please open an issue in the GitHub repository or contact the maintainers at adarsh.gupta@bca.christuniversity.in or via GitHub to the collaborators.

- Project Link: [https://github.com/zs0c131y/trustvault](https://github.com/zs0c131y/trustvault)
