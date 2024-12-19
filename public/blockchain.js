document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const verifyButton = document.getElementById('verifyButton');
    const errorMessage = document.getElementById('errorMessage');
    const resultContainer = document.getElementById('resultContainer');
    const backButton = document.getElementById('backButton');

    const isValidEthereumAddress = (address) => {
        const ethereumRegex = /^0x[a-fA-F0-9]{40}$/;
        return ethereumRegex.test(address);
    };

    const createVerifiedProperty = (blockchainId) => {
        return `
        <div class="property-details">
                    Congratulations! Your Property is Verified on Blockchain
                </div>
            <div class="property-card">
                <img src="./assets/defaultlandimage.png" alt="Property Image" class="property-image">
                <img src="./assets/verified.png" class="verification-badge">
                <div class="property-title">Sobha Oakshire - C 609</div>
                 <div class="address">
                    Townhouse complex
                </div>
                <div class="address-details">
                    Thimmegowdana Hosahalli Village, Hobli, Kasaba, Devanahalli, Bengaluru, Karnataka 562110, India
                </div>
            </div>
        `;
    };

    const createPendingMessage = (blockchainId) => {
        return `
            <div class="verification-message">
                <img src="./assets/notverified.png" class="verification-icon">
                <p class="message-text">
                    Hello, we are still verifying to hear back from relevant departments regarding your blockchain ID.
                    We will let you know that the property is Not Verified on Blockchain yet.
                </p>
            </div>
        `;
    };

    const handleVerification = () => {
        const value = searchInput.value;
       
        if (!isValidEthereumAddress(value)) {
            errorMessage.style.display = 'block';
            resultContainer.innerHTML = '';
            return;
        }

        errorMessage.style.display = 'none';
       
        if (value === '0x1234567890123456789012345678901234567890') {
            resultContainer.innerHTML = createVerifiedProperty(value);
        } else {
            resultContainer.innerHTML = createPendingMessage(value);
        }
    };

    // Enable/disable verify button based on input
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        errorMessage.style.display = 'none';
        verifyButton.disabled = !value;
    });

    // Handle verification on button click
    verifyButton.addEventListener('click', handleVerification);

    // Handle back button click
    document.getElementById("backButton").addEventListener("click", () => {
        history.back(); // Navigates to the previous page
    });


    // Handle enter key press
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !verifyButton.disabled) {
            handleVerification();
        }
    });
});