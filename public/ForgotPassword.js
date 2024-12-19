document.getElementById("sendOtpBtn").addEventListener("click", function () {
    const button = this;
  
    // Change button text and appearance
    button.textContent = "OTP Sent ✅";
    button.classList.add("sent");
  });

    