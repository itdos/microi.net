mergeInto(LibraryManager.library, {
  MicroiUnity_NotifyReady: function () {
    if (typeof window !== 'undefined' && typeof window.onMicroiUnityReady === 'function') {
      window.onMicroiUnityReady();
    }
  },

  MicroiUnity_NotifyAuthorizationRotated: function (tokenPtr, requestTokenPtr) {
    var token = UTF8ToString(tokenPtr);
    var requestToken = UTF8ToString(requestTokenPtr);
    if (typeof window !== 'undefined' && typeof window.onMicroiUnityAuthorizationRotated === 'function') {
      window.onMicroiUnityAuthorizationRotated(token, requestToken);
    }
  },

  MicroiUnity_Emit: function (eventNamePtr, payloadPtr) {
    var eventName = UTF8ToString(eventNamePtr);
    var payload = UTF8ToString(payloadPtr);
    if (typeof window !== 'undefined' && typeof window.onMicroiUnityEvent === 'function') {
      window.onMicroiUnityEvent(eventName, payload);
    }
  }
});
