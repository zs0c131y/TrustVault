// Animation for new activities
document.querySelectorAll('.new-activity').forEach(element => {
    element.addEventListener('mouseover', () => {
      element.style.animation = 'none';
    });
  });

  // Interactive buttons
  document.getElementById('view-property').addEventListener("click", () => {
      window.location = "./viewdetail.html";
    });
    
    document.getElementById('view-all-activities').addEventListener("click", () => {
      window.location = "./activity.html";
    });
    document.getElementById('view-documents').addEventListener("click", () => {
      window.location = "./viewdoc.html";
    });

  document.getElementById('upload-profile-picture').addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          // Update the profile picture with the uploaded image
          document.getElementById('profile-picture').src = e.target.result;
          alert('Profile picture updated successfully!');
        };
        reader.readAsDataURL(file);
      } else {
        alert('No file selected.');
      }
    });
    
    // Add hover effect to display upload intent
    document.querySelector('.profile-picture').addEventListener('mouseover', () => {
      document.querySelector('.profile-picture').style.opacity = '0.8';
    });
    
    document.querySelector('.profile-picture').addEventListener('mouseout', () => {
      document.querySelector('.profile-picture').style.opacity = '1';
    });