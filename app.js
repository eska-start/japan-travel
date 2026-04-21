import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCvPZsh-90NF_eXJQt_VJj0XfqeI9RsklE",
    authDomain: "travel-fbb26.firebaseapp.com",
    databaseURL: "https://travel-fbb26-default-rtdb.firebaseio.com/",
    projectId: "travel-fbb26",
    storageBucket: "travel-fbb26.firebasestorage.app",
    messagingSenderId: "182068561482",
    appId: "1:182068561482:web:387bb1fe527381462588b3",
    measurementId: "G-81GHFH9Z2E"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Default State ---
const defaultState = {
    tripTag: 'OSAKA & KYOTO 2024',
    tripTitle: '오사카 & 교토 힐링 여행',
    tripStartDate: '',
    tripEndDate: '',
    tripDateRange: '날짜를 설정해 주세요',
    flight: {
        deptCode: 'ICN', deptName: '인천 국제공항', deptTime: '10:30 AM',
        arrCode: 'KIX', arrName: '간사이 국제공항', arrTime: '12:40 PM',
        flightNo: 'OZ112', duration: '2h 10m', gate: '게이트 정보',
        date: '2024년 10월 15일 (화)'
    },
    rental: {
        pickTime: '10/16 09:00 AM', returnPlace: '교토역 앞 토요타 렌터카', carInfo: '토요타 야리스 (소형)'
    },
    stays: []
};

// --- State Management ---
const getTripId = () => {
    const hash = window.location.hash.substring(1);
    return hash ? decodeURIComponent(hash) : 'default-trip';
};

let appState = { ...defaultState };
let currentEditType = null;
let currentStayId = null;

// --- Trip Selection Logic ---
window.joinTrip = () => {
    const input = document.getElementById('trip-id-input');
    const tripId = input.value.trim();
    if (tripId) window.location.hash = tripId;
};

window.joinTripMain = () => {
    const input = document.getElementById('main-trip-id-input');
    const tripId = input.value.trim();
    if (tripId) {
        window.location.hash = tripId;
    } else {
        alert("이동할 여행 코드를 입력해 주세요!");
    }
};

// Enter key support for trip IDs
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (document.activeElement.id === 'trip-id-input') joinTrip();
        if (document.activeElement.id === 'main-trip-id-input') joinTripMain();
    }
});

function updateCurrentTripDisplay() {
    const tripId = getTripId();
    const sidebarDisplay = document.getElementById('current-trip-id');
    const sectionDisplay = document.getElementById('section-trip-id-display');
    
    if (sidebarDisplay) sidebarDisplay.innerHTML = `<i class="fas fa-link"></i> 현재 코드: <strong>${tripId}</strong>`;
    if (sectionDisplay) sectionDisplay.innerText = tripId;
}

// --- Sync Status Handler ---
function updateSyncStatus(status, color) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (dot && text) {
        dot.style.background = color;
        text.innerText = status;
    }
}

// --- Rendering Functions ---

function renderAll() {
    renderTitle();
    renderFlight();
    renderRental();
    renderStays();
    updateCurrentTripDisplay();
}

function renderTitle() {
    const tagEl = document.getElementById('main-tag');
    const titleEl = document.getElementById('main-title');
    const dateEl = document.getElementById('main-date');
    if (tagEl) tagEl.innerText = appState.tripTag || defaultState.tripTag;
    if (titleEl) titleEl.innerText = appState.tripTitle || defaultState.tripTitle;
    if (dateEl) dateEl.innerHTML = `<i class="far fa-calendar"></i> ${appState.tripDateRange || defaultState.tripDateRange}`;
}

function renderFlight() {
    const f = appState.flight || defaultState.flight;
    const container = document.getElementById('flight-display');
    if(!container) return;
    container.innerHTML = `
        <div class="flight-info">
            <div class="departure">
                <div class="airport-code">${f.deptCode || '-'}</div>
                <div class="airport-name">${f.deptName || '-'}</div>
                <div class="time">${f.deptTime || '-'}</div>
            </div>
            <div class="flight-path">
                <span>${f.flightNo || '-'}</span>
                <div class="plane-icon"><i class="fas fa-plane"></i></div>
                <span>${f.duration || '-'}</span>
            </div>
            <div class="arrival">
                <div class="airport-code">${f.arrCode || '-'}</div>
                <div class="airport-name">${f.arrName || '-'}</div>
                <div class="time">${f.arrTime || '-'}</div>
            </div>
        </div>
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; display: flex; gap: 20px;">
            <div class="info-item">
                <span class="label">탑승 위치</span>
                <span class="value">${f.gate || '-'}</span>
            </div>
            <div class="info-item">
                <span class="label">날짜</span>
                <span class="value">${f.date || '-'}</span>
            </div>
        </div>
    `;
}

function renderRental() {
    const r = appState.rental || defaultState.rental;
    const container = document.getElementById('rental-display');
    if(!container) return;
    container.innerHTML = `
        <div class="info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div class="info-item">
                <span class="label">빌리는 시간</span>
                <span class="value">${r.pickTime || '-'}</span>
            </div>
            <div class="info-item">
                <span class="label">반납 장소</span>
                <span class="value">${r.returnPlace || '-'}</span>
            </div>
            <div class="info-item">
                <span class="label">차량 정보</span>
                <span class="value">${r.carInfo || '-'}</span>
            </div>
        </div>
    `;
}

function renderStays() {
    const container = document.getElementById('stay-container');
    if(!container) return;
    container.innerHTML = (appState.stays || []).map(stay => `
        <div class="card" id="stay-${stay.id}">
            <div class="flex-between">
                <div>
                    <h3 style="font-size: 1.2rem; margin-bottom: 5px;">${stay.name || '미지정 숙소'}</h3>
                    <p style="color: var(--text-sub); font-size: 0.9rem;"><i class="fas fa-map-marker-alt"></i> ${stay.address || '주소 없음'}</p>
                </div>
                <div style="text-align: right;">
                    <span class="tag">${stay.days || 'Day -'}</span>
                    <div style="font-size: 0.8rem; margin-top: 10px; color: var(--text-sub);">
                        <p><strong>입실:</strong> ${stay.checkInDate || '-'} ${stay.checkInTime || ''}</p>
                        <p><strong>퇴실:</strong> ${stay.checkOutDate || '-'} ${stay.checkOutTime || ''}</p>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end;">
                        <i class="fas fa-edit" style="color: var(--text-sub); cursor: pointer;" onclick="openEditModal('stay', '${stay.id}')"></i>
                        <i class="fas fa-trash" style="color: #ff7675; cursor: pointer;" onclick="deleteStay('${stay.id}')"></i>
                    </div>
                </div>
            </div>
            
            <div class="actions">
                <button class="btn-map" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.name)}')">
                    <i class="fas fa-map"></i> 구글 지도 보기
                </button>
            </div>

            <div class="sub-itinerary-list" id="sub-list-${stay.id}">
                ${(stay.subItems || []).map(item => `
                    <div class="sub-item">
                        <div>
                            <span style="font-weight: 700; margin-right: 10px;">${item.time}</span>
                            <span>${item.desc}</span>
                        </div>
                        <i class="fas fa-times" style="color: #ccc; cursor: pointer;" onclick="deleteSubItem('${stay.id}', '${item.time}', '${item.desc}')"></i>
                    </div>
                `).join('')}
            </div>
            <button class="btn-add-sub" onclick="openAddSubModal('${stay.id}')"><i class="fas fa-plus"></i> 세부 일정 추가</button>
        </div>
    `).join('');
}

// --- Modal Functions ---

window.openEditModal = (type, stayId = null) => {
    currentEditType = type;
    currentStayId = stayId;
    const modal = document.getElementById('editModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    modal.style.display = 'flex';
    body.innerHTML = '';

    if (type === 'title') {
        title.innerText = '여행 제목 및 일정 수정';
        body.innerHTML = `
            <label class="label">상단 태그 (영문)</label><input type="text" id="edit-tripTag" value="${appState.tripTag || ''}">
            <label class="label">여행 제목</label><input type="text" id="edit-tripTitle" value="${appState.tripTitle || ''}">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><label class="label">시작 날짜 (달력)</label><input type="date" id="edit-tripStartDate" value="${appState.tripStartDate || ''}"></div>
                <div><label class="label">종료 날짜 (달력)</label><input type="date" id="edit-tripEndDate" value="${appState.tripEndDate || ''}"></div>
            </div>
        `;
    } else if (type === 'flight') {
        title.innerText = '항공편 정보 수정';
        const f = appState.flight || defaultState.flight;
        body.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><label class="label">출발지 (코드)</label><input type="text" id="edit-deptCode" value="${f.deptCode || ''}"></div>
                <div><label class="label">도착지 (코드)</label><input type="text" id="edit-arrCode" value="${f.arrCode || ''}"></div>
                <div><label class="label">출발지 (공항명)</label><input type="text" id="edit-deptName" value="${f.deptName || ''}"></div>
                <div><label class="label">도착지 (공항명)</label><input type="text" id="edit-arrName" value="${f.arrName || ''}"></div>
                <div><label class="label">출발 시간</label><input type="text" id="edit-deptTime" value="${f.deptTime || ''}"></div>
                <div><label class="label">도착 시간</label><input type="text" id="edit-arrTime" value="${f.arrTime || ''}"></div>
                <div><label class="label">편명</label><input type="text" id="edit-flightNo" value="${f.flightNo || ''}"></div>
                <div><label class="label">탑승 위치 (게이트)</label><input type="text" id="edit-gate" value="${f.gate || ''}"></div>
                <div style="grid-column: span 2;"><label class="label">날짜</label><input type="text" id="edit-date" value="${f.date || ''}"></div>
            </div>
        `;
    } else if (type === 'rental') {
        title.innerText = '렌트카 정보 수정';
        const r = appState.rental || defaultState.rental;
        body.innerHTML = `
            <label class="label">빌리는 시간</label><input type="text" id="edit-pickTime" value="${r.pickTime || ''}">
            <label class="label">반납 장소</label><input type="text" id="edit-returnPlace" value="${r.returnPlace || ''}">
            <label class="label">차량 정보</label><input type="text" id="edit-carInfo" value="${r.carInfo || ''}">
        `;
    } else if (type === 'stay') {
        const stay = stayId ? appState.stays.find(s => s.id == stayId) : null;
        title.innerText = stay ? '숙소 정보 수정' : '새 숙소 추가';
        body.innerHTML = `
            <label class="label">숙소 이름</label><input type="text" id="edit-stayName" value="${stay ? stay.name : ''}">
            <label class="label">주소</label><input type="text" id="edit-stayAddress" value="${stay ? stay.address : ''}">
            <label class="label">기간 (예: Day 1 - 3)</label><input type="text" id="edit-stayDays" value="${stay ? stay.days : ''}">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><label class="label">입실 날짜</label><input type="date" id="edit-stayCheckInDate" value="${stay ? stay.checkInDate : ''}" onchange="handleCheckInChange(this.value)"></div>
                <div><label class="label">입실 시간</label><input type="time" id="edit-stayCheckInTime" value="${stay ? stay.checkInTime : ''}"></div>
                <div><label class="label">퇴실 날짜</label><input type="date" id="edit-stayCheckOutDate" value="${stay ? stay.checkOutDate : ''}"></div>
                <div><label class="label">퇴실 시간</label><input type="time" id="edit-stayCheckOutTime" value="${stay ? stay.checkOutTime : ''}"></div>
            </div>
        `;
    }
}

window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
}

function calculateDuration(start, end) {
    if (!start || !end) return '';
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diff = d2.getTime() - d1.getTime();
    const nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (nights < 0) return '기간 설정 오류';
    return `${start.replace(/-/g, '.')} - ${end.replace(/-/g, '.')} (${nights}박 ${nights + 1}일)`;
}

window.saveEdit = () => {
    try {
        updateSyncStatus("저장 중...", "#f1c40f");
        if (currentEditType === 'title') {
            appState.tripTag = document.getElementById('edit-tripTag').value;
            appState.tripTitle = document.getElementById('edit-tripTitle').value;
            appState.tripStartDate = document.getElementById('edit-tripStartDate').value;
            appState.tripEndDate = document.getElementById('edit-tripEndDate').value;
            appState.tripDateRange = calculateDuration(appState.tripStartDate, appState.tripEndDate);
        } else if (currentEditType === 'flight') {
            appState.flight = {
                deptCode: document.getElementById('edit-deptCode').value,
                arrCode: document.getElementById('edit-arrCode').value,
                deptName: document.getElementById('edit-deptName').value,
                arrName: document.getElementById('edit-arrName').value,
                deptTime: document.getElementById('edit-deptTime').value,
                arrTime: document.getElementById('edit-arrTime').value,
                flightNo: document.getElementById('edit-flightNo').value,
                gate: document.getElementById('edit-gate').value,
                date: document.getElementById('edit-date').value,
                duration: (appState.flight && appState.flight.duration) || '2h 10m'
            };
        } else if (currentEditType === 'rental') {
            appState.rental = {
                pickTime: document.getElementById('edit-pickTime').value,
                returnPlace: document.getElementById('edit-returnPlace').value,
                carInfo: document.getElementById('edit-carInfo').value
            };
        } else if (currentEditType === 'stay') {
            const stayData = {
                name: document.getElementById('edit-stayName').value,
                address: document.getElementById('edit-stayAddress').value,
                days: document.getElementById('edit-stayDays').value,
                checkInDate: document.getElementById('edit-stayCheckInDate').value,
                checkInTime: document.getElementById('edit-stayCheckInTime').value,
                checkOutDate: document.getElementById('edit-stayCheckOutDate').value,
                checkOutTime: document.getElementById('edit-stayCheckOutTime').value,
            };

            if (currentStayId) {
                const index = appState.stays.findIndex(s => s.id == currentStayId);
                if (index !== -1) appState.stays[index] = { ...appState.stays[index], ...stayData };
            } else {
                if(!appState.stays) appState.stays = [];
                appState.stays.push({ id: String(Date.now()), ...stayData, subItems: [] });
            }
        }

        saveToFirebase();
        closeEditModal();
    } catch (e) {
        console.error("저장 오류:", e);
        updateSyncStatus("저장 실패", "#e74c3c");
    }
}

// --- Sub Itinerary Logic ---

window.openAddSubModal = (stayId) => {
    currentStayId = stayId;
    document.getElementById('addSubModal').style.display = 'flex';
}

window.closeSubModal = () => {
    document.getElementById('addSubModal').style.display = 'none';
    document.getElementById('itemTime').value = '';
    document.getElementById('itemDesc').value = '';
}

window.addItineraryItem = () => {
    const time = document.getElementById('itemTime').value;
    const desc = document.getElementById('itemDesc').value;
    if (!time || !desc) return;
    const stay = appState.stays.find(s => s.id == currentStayId);
    if (stay) {
        if(!stay.subItems) stay.subItems = [];
        stay.subItems.push({ time, desc });
        saveToFirebase();
    }
    closeSubModal();
}

window.deleteSubItem = (stayId, time, desc) => {
    const stay = appState.stays.find(s => s.id == stayId);
    if (stay) {
        stay.subItems = stay.subItems.filter(item => !(item.time === time && item.desc === desc));
        saveToFirebase();
    }
}

window.deleteStay = (stayId) => {
    if(confirm('이 숙소와 관련된 모든 일정을 삭제하시겠습니까?')) {
        appState.stays = appState.stays.filter(s => s.id != stayId);
        saveToFirebase();
    }
}

// --- Exchange Rate API ---

async function updateExchangeRate() {
    const rateEl = document.getElementById('exchange-rate');
    const updateEl = document.getElementById('last-update');
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/JPY');
        const data = await response.json();
        const krwRate = data.rates.KRW;
        if(rateEl) rateEl.innerHTML = `100 JPY = <span style="color: var(--primary);">${(krwRate * 100).toFixed(2)}</span> KRW`;
        if(updateEl) updateEl.innerText = `마지막 업데이트: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        if(rateEl) rateEl.innerText = '환율 정보 로드 실패';
    }
}

// --- Firebase Sync ---

function saveToFirebase() {
    const tripId = getTripId();
    const tripRef = ref(db, 'trips/' + tripId);
    set(tripRef, appState).then(() => {
        updateSyncStatus("클라우드 저장됨", "#2ecc71");
        setTimeout(() => updateSyncStatus("연결됨", "#2ecc71"), 3000);
    }).catch(error => {
        console.error("Firebase 저장 실패:", error);
        updateSyncStatus("저장 실패", "#e74c3c");
    });
}

function loadFromFirebase() {
    const tripId = getTripId();
    const tripRef = ref(db, 'trips/' + tripId);

    // Connection monitoring
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            updateSyncStatus("연결됨", "#2ecc71");
        } else {
            updateSyncStatus("연결 끊김", "#e74c3c");
        }
    });

    onValue(tripRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            appState = { ...defaultState, ...data };
            if(!appState.stays) appState.stays = [];
            renderAll();
            updateSyncStatus("최신 데이터 수신", "#2ecc71");
            setTimeout(() => updateSyncStatus("연결됨", "#2ecc71"), 2000);
        } else {
            saveToFirebase();
        }
    });
}

// --- Helper Functions ---

window.handleCheckInChange = (checkInDate) => {
    const checkOutInput = document.getElementById('edit-stayCheckOutDate');
    if (!checkInDate || !checkOutInput) return;
    const date = new Date(checkInDate);
    date.setDate(date.getDate() + 1);
    const minDate = date.toISOString().split('T')[0];
    checkOutInput.min = minDate;
    if (!checkOutInput.value || checkOutInput.value < minDate) {
        checkOutInput.value = minDate;
    }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    loadFromFirebase();
    updateExchangeRate();
    setInterval(updateExchangeRate, 3600000);
});

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeEditModal();
        closeSubModal();
    }
}

window.onhashchange = () => {
    window.location.reload();
};
