(function () {
  "use strict";

  const ready = (callback) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  };

  function validBookingUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function localDateTimeValue(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  ready(() => {
    const timezone = document.querySelector("[data-timezone]");
    if (timezone && !timezone.value.trim()) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (typeof detected === "string" && detected.trim()) timezone.value = detected;
      } catch (error) {
        /* The field stays editable if the browser cannot detect a zone. */
      }
    }

    const now = new Date();
    now.setSeconds(0, 0);
    document.querySelectorAll('input[type="datetime-local"][data-preferred-time]').forEach((input) => {
      input.min = localDateTimeValue(now);
    });

    const calendarLink = document.querySelector("[data-live-calendar]");
    const configured = window.BALHENCE_CONFIG && window.BALHENCE_CONFIG.calendar;
    const bookingUrl = validBookingUrl(configured && configured.bookingUrl);
    if (!calendarLink || !bookingUrl) return;
    calendarLink.href = bookingUrl;
    calendarLink.hidden = false;
  });
})();
