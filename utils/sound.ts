// Updated to "Cell phone notification" style
// Using a sharp, distinct mobile alert sound (Mixkit 2869)

export const playNotificationSound = () => {
  try {
    // ID 2869: Mobile Device Alert / Sharp Ping
    // This sounds like a standard smartphone notification
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    
    // Set volume to maximum to ensure it's heard
    audio.volume = 1.0;
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn("Audio play blocked (user interaction usually required first):", e);
      });
    }
  } catch (error) {
    console.error("Error playing sound", error);
  }
};