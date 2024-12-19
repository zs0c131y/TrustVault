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
                    Congratulations! Your Document is Verified
                </div>
            <div class="property-card">
                <div class="property-title">Document Type: <span id="document">Aadhaar Card</span></div>
                 <div class="address">Verified On: <span id="date">12/12/2024</span>
                </div>
                
            </div>
        `;
    };

    const createPendingMessage = (blockchainId) => {
        return `
            <div class="property-details">
                    Your Document is Not Verified
                </div>
            <div class="property-card">
                <div class="property-title">Document Type: NAN</div>
                 <div class="address">
Verified On: Not Verified
                </div>
                
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