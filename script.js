document.addEventListener("DOMContentLoaded", () => {
  // === ELEMEN DOM ===
  const locationDisplay = document.getElementById("lokasi");
  const dateMasehiDisplay = document.getElementById("tanggal-masehi");
  const dateHijriyahDisplay = document.getElementById("tanggal-hijriyah");
  const clockDisplay = document.getElementById("live-clock");
  const hourHand = document.getElementById("hour-hand");
  const minuteHand = document.getElementById("minute-hand");
  const secondHand = document.getElementById("second-hand");

  const prayerTimeElements = {
    imsak: document.getElementById("imsak"),
    syuruq: document.getElementById("syuruq"),
    subuh: document.getElementById("subuh"),
    dzuhur: document.getElementById("dzuhur"),
    ashar: document.getElementById("ashar"),
    maghrib: document.getElementById("maghrib"),
    isya: document.getElementById("isya"),
  };

  const nextPrayerInfoEl = document.getElementById("next-prayer-info");
  const nextPrayerNameEl = document.getElementById("next-prayer-name");
  const countdownTimerEl = document.getElementById("countdown-timer");
  const runningTextEl = document.querySelector(".running-text");

  const searchInput = document.getElementById("search-input");
  const searchButton = document.getElementById("search-button");
  const detectLocationButton = document.getElementById(
    "detect-location-button"
  );
  const searchResultsContainer = document.getElementById("search-results");

  const prayerCards = document.querySelectorAll(".card");

  // === VARIABEL GLOBAL & KONSTANTA ===
  let countdownInterval;
  const KEMENAG_API_BASE_URL = "https://api.myquran.com/v2";
  const DEFAULT_CITY = { id: "1301", lokasi: "KAB. BOGOR" }; // Default ke Bogor
  const STORAGE_KEY_CITY = "last_city";

  // === FUNGSI UTAMA JAM & TANGGAL ===

  /**
   * Menggerakkan jarum jam analog dan memperbarui jam digital.
   */
  function startLiveClock() {
    function updateClock() {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();

      // Digital Clock
      clockDisplay.textContent = now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // Analog Clock (Transformasi Rotasi)
      const hDeg = (h % 12) * 30 + (m / 60) * 30 - 90; // -90 derajat untuk start dari jam 12 (vertikal)
      const mDeg = m * 6 + (s / 60) * 6 - 90;
      const sDeg = s * 6 - 90;

      hourHand.style.transform = `rotate(${hDeg}deg)`;
      minuteHand.style.transform = `rotate(${mDeg}deg)`;
      secondHand.style.transform = `rotate(${sDeg}deg)`;
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  /**
   * Menampilkan tanggal hari ini (Masehi & Hijriyah).
   */
  async function displayCurrentDate() {
    const now = new Date();
    const masehiOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };

    // 1. Tanggal Masehi
    dateMasehiDisplay.textContent = now.toLocaleDateString(
      "id-ID",
      masehiOptions
    );

    // 2. Tanggal Hijriyah (Menggunakan API Aladhan)
    try {
      const response = await fetch("https://api.aladhan.com/v1/gToH");
      const result = await response.json();
      const hijriData = result.data.hijri;
      const hijriDate = `${hijriData.day} ${hijriData.month.en} ${hijriData.year} H`;
      dateHijriyahDisplay.textContent = hijriDate;
    } catch (error) {
      console.error("Error fetching Hijri date:", error);
      dateHijriyahDisplay.textContent = "--- Hijriyah ---";
    }
  }

  // === FUNGSI JADWAL SHOLAT & HITUNG MUNDUR ===

  /**
   * Mengambil jadwal sholat berdasarkan ID kota.
   * @param {string} cityId
   * @param {string} cityName
   */
  async function getPrayerTimes(cityId, cityName) {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      const response = await fetch(
        `${KEMENAG_API_BASE_URL}/sholat/jadwal/${cityId}/${year}/${month}/${day}`
      );
      if (!response.ok) throw new Error("Gagal mengambil data jadwal sholat.");

      const result = await response.json();

      if (result.status && result.data && result.data.jadwal) {
        const prayerData = result.data.jadwal;
        updateUIPrayerTimes(prayerData, cityName);
        startCountdown(prayerData);
        // Simpan lokasi yang berhasil dimuat
        localStorage.setItem(
          STORAGE_KEY_CITY,
          JSON.stringify({ id: cityId, lokasi: cityName })
        );
      } else {
        throw new Error("Format data tidak sesuai.");
      }
    } catch (error) {
      console.error("Error fetching prayer times:", error);
      alert("Tidak dapat memuat jadwal sholat. Silakan coba lagi.");
      locationDisplay.textContent = "Gagal Memuat";
    }
  }

  /**
   * Memperbarui UI dengan jadwal sholat.
   * @param {object} prayerData
   * @param {string} cityName
   */
  function updateUIPrayerTimes(prayerData, cityName) {
    locationDisplay.textContent = cityName;

    prayerTimeElements.imsak.textContent = prayerData.imsak;
    prayerTimeElements.syuruq.textContent = prayerData.terbit; // 'terbit' dari API Kemenag
    prayerTimeElements.subuh.textContent = prayerData.subuh;
    prayerTimeElements.dzuhur.textContent = prayerData.dzuhur;
    prayerTimeElements.ashar.textContent = prayerData.ashar;
    prayerTimeElements.maghrib.textContent = prayerData.maghrib;
    prayerTimeElements.isya.textContent = prayerData.isya;
  }

  /**
   * Memulai hitung mundur dan penyorotan kartu sholat.
   * @param {object} prayerData
   */
  function startCountdown(prayerData) {
    if (countdownInterval) clearInterval(countdownInterval);

    // Jadwal Sholat Wajib + Imsak (Syuruq TIDAK dihitung)
    const prayerSchedule = [
      { name: "Imsak", time: prayerData.imsak },
      { name: "Subuh", time: prayerData.subuh },
      { name: "Dzuhur", time: prayerData.dzuhur },
      { name: "Ashar", time: prayerData.ashar },
      { name: "Maghrib", time: prayerData.maghrib },
      { name: "Isya", time: prayerData.isya },
    ];

    countdownInterval = setInterval(() => {
      const now = new Date();
      let nextPrayer = null;

      // 1. Mencari Waktu Sholat Berikutnya
      for (const prayer of prayerSchedule) {
        const [hour, minute] = prayer.time.split(":");
        const prayerTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hour,
          minute,
          0 // Detik diatur ke 0
        );

        if (prayerTime > now) {
          nextPrayer = { name: prayer.name, time: prayerTime };
          break;
        }
      }

      // 2. Jika semua sudah lewat, hitung mundur ke Imsak hari berikutnya
      if (!nextPrayer) {
        const [hour, minute] = prayerSchedule[0].time.split(":");
        const nextDayPrayerTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          hour,
          minute,
          0
        );
        nextPrayer = { name: prayerSchedule[0].name, time: nextDayPrayerTime };
      }

      // 3. Memperbarui UI
      updateCountdownDisplay(nextPrayer, prayerData);

      // 4. Highlight Kartu
      highlightNextPrayerCard(nextPrayer.name);
    }, 1000);
  }

  /**
   * Memperbarui tampilan hitung mundur dan running text.
   * @param {object} nextPrayer
   * @param {object} fullPrayerData
   */
  function updateCountdownDisplay(nextPrayer, fullPrayerData) {
    const now = new Date();
    const diff = nextPrayer.time - now;

    // Logika highlight warna merah saat countdown mendekati 0
    const MINUTES_TO_HIGHLIGHT = 5; // 5 menit terakhir
    if (diff <= MINUTES_TO_HIGHLIGHT * 60 * 1000 && diff > 0) {
      nextPrayerInfoEl.classList.add("countdown-near-end");
    } else if (diff <= 0) {
      // Sholat telah tiba
      nextPrayerInfoEl.classList.remove("countdown-near-end");
      nextPrayerInfoEl.classList.add("next-prayer-highlight"); // Opsional: tetap hijau/default

      // Hentikan interval sebentar untuk transisi
      clearInterval(countdownInterval);

      // Tampilkan notifikasi "Waktunya Sholat"
      countdownTimerEl.textContent = "Waktunya Sholat!";
      nextPrayerNameEl.textContent = nextPrayer.name;

      // Muat ulang jadwal setelah 10 detik agar countdown beralih ke waktu berikutnya
      setTimeout(() => {
        const lastCity =
          JSON.parse(localStorage.getItem(STORAGE_KEY_CITY)) || DEFAULT_CITY;
        getPrayerTimes(lastCity.id, lastCity.lokasi);
      }, 10000);

      return;
    } else {
      nextPrayerInfoEl.classList.remove("countdown-near-end");
    }

    // Perhitungan waktu
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const countdownTime = `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    nextPrayerNameEl.textContent = nextPrayer.name;
    countdownTimerEl.textContent = countdownTime;

    const nextPrayerTimeFormatted = nextPrayer.time.toLocaleTimeString(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    // 1. Info Sholat Berikutnya
    const nextPrayerInfo = `Waktu ${nextPrayer.name} akan tiba pada ${nextPrayerTimeFormatted}. Masih ada waktu ${countdownTime} lagi. Mohon siapkan diri Anda.`;

    // 2. Jadwal Lengkap
    const allTimes = `| Imsak: ${fullPrayerData.imsak} | Syuruq (Terbit): ${fullPrayerData.terbit} | Subuh: ${fullPrayerData.subuh} | Dzuhur: ${fullPrayerData.dzuhur} | Ashar: ${fullPrayerData.ashar} | Maghrib: ${fullPrayerData.maghrib} | Isya: ${fullPrayerData.isya} |`;

    const dynamicText = `${nextPrayerInfo} -------------------- JADWAL SHOLAT HARI INI: ${allTimes} --------------------`;

    if (runningTextEl) {
      runningTextEl.textContent = dynamicText;
    }
  }

  /**
   * Memberi sorotan pada kartu waktu sholat berikutnya. Syuruq diabaikan.
   * @param {string} nextPrayerName
   */
  function highlightNextPrayerCard(nextPrayerName) {
    prayerCards.forEach((card) => {
      // Hanya sorot sholat wajib atau Imsak
      const prayerDataName = card.getAttribute("data-prayer");

      if (prayerDataName === nextPrayerName && prayerDataName !== "Syuruq") {
        card.classList.add("next-prayer-highlight");
      } else {
        card.classList.remove("next-prayer-highlight");
      }
    });
  }

  // === FUNGSI PENCARIAN & GEOLOKASI (DENGAN LOCAL STORAGE) ===

  async function searchCity() {
    const query = searchInput.value.trim();
    if (query.length < 3) {
      alert("Masukkan minimal 3 karakter untuk mencari kota.");
      return;
    }
    // ... (Logika pencarian kota tetap sama) ...
    try {
      const response = await fetch(
        `${KEMENAG_API_BASE_URL}/sholat/kota/cari/${query}`
      );
      const result = await response.json();
      displaySearchResults(result.data);
    } catch (error) {
      console.error("Error searching city:", error);
      alert("Gagal mencari kota. Periksa koneksi Anda.");
    }
  }

  /**
   * @param {Array} cities
   */
  function displaySearchResults(cities) {
    searchResultsContainer.innerHTML = "";
    if (!cities || cities.length === 0) {
      searchResultsContainer.innerHTML =
        '<p class="result-item">Kota tidak ditemukan.</p>';
      return;
    }

    cities.forEach((city) => {
      const item = document.createElement("div");
      item.classList.add("result-item");
      item.textContent = city.lokasi;
      item.addEventListener("click", () => {
        getPrayerTimes(city.id, city.lokasi);
        searchResultsContainer.innerHTML = "";
        searchInput.value = "";
      });
      searchResultsContainer.appendChild(item);
    });
  }

  function useCurrentLocation() {
    if ("geolocation" in navigator) {
      locationDisplay.textContent = "Mendeteksi lokasi...";
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            // Reverse Geocoding untuk mendapatkan nama kota
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const city =
              data.address.city || data.address.state || "Lokasi Tidak Dikenal";

            // Mencari ID Kemenag berdasarkan nama kota
            const searchResponse = await fetch(
              `${KEMENAG_API_BASE_URL}/sholat/kota/cari/${city.split(" ")[0]}`
            );
            const searchData = await searchResponse.json();

            if (searchData.data && searchData.data.length > 0) {
              const cityId = searchData.data[0].id;
              const cityName = searchData.data[0].lokasi;
              getPrayerTimes(cityId, cityName);
            } else {
              getPrayerTimes(DEFAULT_CITY.id, DEFAULT_CITY.lokasi);
              alert(
                `Tidak dapat menemukan kota Anda (${city}), menampilkan jadwal untuk ${DEFAULT_CITY.lokasi}.`
              );
            }
          } catch (error) {
            console.error(
              "Error with reverse geocoding or city search:",
              error
            );
            getPrayerTimes(DEFAULT_CITY.id, DEFAULT_CITY.lokasi);
            alert(
              `Gagal mendapatkan nama lokasi, menampilkan jadwal untuk ${DEFAULT_CITY.lokasi}.`
            );
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert(
            `Gagal mengakses lokasi. Menampilkan jadwal untuk ${DEFAULT_CITY.lokasi}.`
          );
          getPrayerTimes(DEFAULT_CITY.id, DEFAULT_CITY.lokasi);
        }
      );
    } else {
      alert(
        `Browser Anda tidak mendukung Geolocation. Menampilkan jadwal untuk ${DEFAULT_CITY.lokasi}.`
      );
      getPrayerTimes(DEFAULT_CITY.id, DEFAULT_CITY.lokasi);
    }
  }

  // === INISIALISASI APLIKASI ===

  function loadLastLocation() {
    const storedCity = localStorage.getItem(STORAGE_KEY_CITY);
    if (storedCity) {
      const lastCity = JSON.parse(storedCity);
      getPrayerTimes(lastCity.id, lastCity.lokasi);
    } else {
      // Jika belum ada di Local Storage, gunakan geolokasi/default
      useCurrentLocation();
    }
  }

  function initialize() {
    startLiveClock();
    displayCurrentDate();
    loadLastLocation(); // Coba muat lokasi terakhir atau gunakan geolokasi
  }

  // === EVENT LISTENERS ===
  searchButton.addEventListener("click", searchCity);
  searchInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      searchCity();
    }
  });
  detectLocationButton.addEventListener("click", useCurrentLocation);

  initialize();
});
