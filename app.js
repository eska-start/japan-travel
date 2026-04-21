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
const getDefaultState = () => ({
    tripTag: 'OSAKA & KYOTO 2024',
    tripTitle: '오사카 & 교토 힐링 여행',
    tripStartDate: '',
    tripEndDate: '',
    tripDateRange: '날짜를 설정해 주세요',
    flight: {
        outbound: {
            deptCode: 'ICN', deptName: '인천', deptTime: '10:30 AM',
            arrCode: 'KIX', arrName: '간사이', arrTime: '12:40 PM',
            flightNo: 'OZ112', duration: '2h 10m', gate: '게이트 정보',
            date: '2024년 10월 15일'
        },
        return: {
            deptCode: 'KIX', deptName: '간사이', deptTime: '18:00 PM',
            arrCode: 'ICN', arrName: '인천', arrTime: '19:50 PM',
            flightNo: 'OZ111', duration: '1h 50m', gate: '게이트 정보',
            date: '2024년 10월 22일'
        }
    },
    rental: {
        pickPlace: '간사이 공항 토요타 렌터카',
        pickTime: '10/15 14:00 PM',
        returnPlace: '교토역 앞 토요타 렌터카',
        returnTime: '10/22 16:00 PM',
        carInfo: '토요타 야리스 (소형)'
    },
    stays: []
});

// --- State Management ---
const getTripId = () => {
    const hash = window.location.hash.substring(1);
    return hash ? decodeURIComponent(hash) : 'default-trip';
};

let appState = getDefaultState();
let currentEditType = null;
let currentStayId = null;

// --- Data Migration Logic ---
function migrateData(data) {
    if (!data) return data;
    if (data.flight) {
        if (!data.flight.outbound) data.flight.outbound = { ...getDefaultState().flight.outbound };
        if (!data.flight.return) data.flight.return = { ...getDefaultState().flight.return };
        // 개별 필드 체크 (도착 시간 등)
        if (data.flight.outbound && !data.flight.outbound.arrTime) data.flight.outbound.arrTime = getDefaultState().flight.outbound.arrTime;
        if (data.flight.return && !data.flight.return.arrTime) data.flight.return.arrTime = getDefaultState().flight.return.arrTime;
    }
    if (data.rental) {
        data.rental = {
            ...getDefaultState().rental,
            ...data.rental
        };
    }
    return data;
}

// --- Trip Selection Logic ---
window.joinTrip = () => {
    const input = document.getElementById('trip-id-input');
    const tripId = input.value.trim();
    if (tripId) window.location.hash = tripId;
};

window.joinTripMain = () => {
    const input = document.getElementById('main-trip-id-input');
    const tripId = input.value.trim();
    if (tripId) window.location.hash = tripId;
};

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (document.activeElement.id === 'main-trip-id-input') joinTripMain();
    }
});

// --- Sync Status Handler ---
function updateSyncStatus(status, color) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (dot && text) {
        dot.style.background = color;
        text.innerText = status;
    }
}

// --- Exchange Rate Logic ---
async function fetchExchangeRate() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/JPY');
        const data = await response.json();
        const rate = data.rates.KRW;
        const lastUpdate = new Date().toLocaleTimeString();
        
        const rateEl = document.getElementById('exchange-rate');
        const updateEl = document.getElementById('last-update');
        
        if (rateEl) rateEl.innerText = `100￥ = ${(rate * 100).toFixed(2)}원`;
        if (updateEl) updateEl.innerText = `최근 업데이트: ${lastUpdate}`;
    } catch (error) {
        console.error('환율 정보 로드 실패:', error);
        const rateEl = document.getElementById('exchange-rate');
        if (rateEl) rateEl.innerText = '정보 로드 실패';
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

function updateCurrentTripDisplay() {
    const tripId = getTripId();
    const sectionDisplay = document.getElementById('section-trip-id-display');
    if (sectionDisplay) sectionDisplay.innerText = tripId;
}

function renderTitle() {
    const tagEl = document.getElementById('main-tag');
    const titleEl = document.getElementById('main-title');
    const dateEl = document.getElementById('main-date');
    if (tagEl) tagEl.innerText = appState.tripTag;
    if (titleEl) titleEl.innerText = appState.tripTitle;
    if (dateEl) dateEl.innerHTML = `<i class="far fa-calendar"></i> ${appState.tripDateRange}`;
}

function renderFlight() {
    const f = appState.flight;
    const container = document.getElementById('flight-display');
    if(!container) return;

    const out = f.outbound;
    const ret = f.return;

    const flightCard = (title, data, icon, color) => `
        <div class="flight-item" style="flex: 1; min-width: 280px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; color: ${color}; font-weight: 700;">
                <i class="fas ${icon}"></i> ${title}
            </div>
            <div class="flight-info" style="padding: 15px; background: #fafafa; border-radius: 15px; border: 1px solid #f0f0f0;">
                <div class="departure">
                    <div class="airport-code" style="font-size: 1.8rem;">${data.deptCode || '-'}</div>
                    <div class="airport-name">${data.deptName || '-'}</div>
                    <div class="time" style="font-weight: 700;">${data.deptTime || '-'}</div>
                </div>
                <div class="flight-path">
                    <span style="font-size: 0.75rem;">${data.flightNo || '-'}</span>
                    <div class="plane-icon" style="background: transparent; margin: 5px 0;"><i class="fas fa-plane" style="color: ${color}"></i></div>
                </div>
                <div class="arrival">
                    <div class="airport-code" style="font-size: 1.8rem;">${data.arrCode || '-'}</div>
                    <div class="airport-name">${data.arrName || '-'}</div>
                    <div class="time" style="font-weight: 700;">${data.arrTime || '-'}</div>
                </div>
            </div>
            <div style="margin-top: 10px; padding-top: 8px; display: flex; gap: 15px; font-size: 0.8rem;">
                <div class="info-item"><span class="label">게이트</span><span class="value" style="color: var(--text-main);">${data.gate || '-'}</span></div>
                <div class="info-item"><span class="label">날짜</span><span class="value" style="color: var(--text-main);">${data.date || '-'}</span></div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
            ${flightCard('출국편 (Outbound)', out, 'fa-plane-departure', 'var(--primary)')}
            ${flightCard('귀국편 (Return)', ret, 'fa-plane-arrival', '#3498db')}
        </div>
    `;
}

function renderRental() {
    const r = appState.rental;
    const container = document.getElementById('rental-display');
    if(!container) return;
    container.innerHTML = `
        <div class="info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div class="info-item">
                <span class="label"><i class="fas fa-map-marker-alt"></i> 빌리는 위치</span><span class="value">${r.pickPlace || '-'}</span>
            </div>
            <div class="info-item">
                <span class="label"><i class="far fa-clock"></i> 빌리는 시간</span><span class="value">${r.pickTime || '-'}</span>
            </div>
            <div class="info-item">
                <span class="label"><i class="fas fa-undo"></i> 반납 위치</span><span class="value">${r.returnPlace || '-'}</span>
            </div>
            <div class="info-item">
                <span class="label"><i class="far fa-clock"></i> 반납 시간</span><span class="value">${r.returnTime || '-'}</span>
            </div>
            <div class="info-item">
                <span class="label"><i class="fas fa-info-circle"></i> 차량 정보</span><span class="value">${r.carInfo || '-'}</span>
            </div>
        </div>
    `;
}

function renderStays() {
    const container = document.getElementById('stay-container');
    if(!container) return;

    const sortedStays = [...(appState.stays || [])].sort((a, b) => {
        if (!a.checkInDate) return 1;
        if (!b.checkInDate) return -1;
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
    });

    container.innerHTML = sortedStays.map(stay => `
        <div class="card" id="stay-${stay.id}" style="margin-bottom: 2rem;">
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
            
            <div class="actions" style="margin-top: 1rem;">
                <button class="btn-map" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.name)}')">
                    <i class="fas fa-map"></i> 구글 지도 보기
                </button>
            </div>

            <!-- 세부 일정 리스트 (여기가 중요!) -->
            <div class="sub-itinerary-list" id="sub-list-${stay.id}" style="margin-top: 1.5rem; border-left: 2px solid #eee; padding-left: 1rem;">
                ${(stay.subItems || []).map(item => `
                    <div class="sub-item" style="padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-weight: 700; margin-right: 10px;">${item.time}</span>
                            <span>${item.desc}</span>
                        </div>
                        <i class="fas fa-times" style="color: #ccc; cursor: pointer;" onclick="deleteSubItem('${stay.id}', '${item.time}', '${item.desc}')"></i>
                    </div>
                `).join('')}
            </div>
            <button class="btn-add-sub" style="width: 100%; padding: 10px; border: 2px dashed #ddd; background: none; border-radius: 10px; margin-top: 10px; cursor: pointer;" onclick="openAddSubModal('${stay.id}')">
                <i class="fas fa-plus"></i> 세부 일정 추가
            </button>
        </div>
    `).join('');
}

// --- Modal Functions ---

window.openEditModal = (type, stayId = null) => {
    currentEditType = type;
    currentStayId = stayId;
    const modal = document.getElementById('editModal');
    const body = document.getElementById('modalBody');
    modal.style.display = 'flex';
    body.innerHTML = '';

    if (type === 'title') {
        body.innerHTML = `
            <label class="label">상단 태그</label><input type="text" id="edit-tripTag" value="${appState.tripTag}">
            <label class="label">여행 제목</label><input type="text" id="edit-tripTitle" value="${appState.tripTitle}">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><label class="label">시작 날짜</label><input type="date" id="edit-tripStartDate" value="${appState.tripStartDate}"></div>
                <div><label class="label">종료 날짜</label><input type="date" id="edit-tripEndDate" value="${appState.tripEndDate}"></div>
            </div>
        `;
    } else if (type === 'flight') {
        const out = appState.flight.outbound;
        const ret = appState.flight.return;
        body.innerHTML = `
            <h4 style="color: var(--primary);">출국편</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="edit-out-deptCode" value="${out.deptCode}" placeholder="출발지 코드">
                <input type="text" id="edit-out-arrCode" value="${out.arrCode}" placeholder="도착지 코드">
                <input type="text" id="edit-out-flightNo" value="${out.flightNo}" placeholder="편명">
                <input type="text" id="edit-out-date" value="${out.date}" placeholder="날짜">
                <input type="text" id="edit-out-deptTime" value="${out.deptTime}" placeholder="출발 시간">
                <input type="text" id="edit-out-arrTime" value="${out.arrTime || ''}" placeholder="도착 시간">
                <input type="text" id="edit-out-gate" value="${out.gate}" placeholder="게이트">
            </div>
            <h4 style="color: #3498db;">귀국편</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input type="text" id="edit-ret-deptCode" value="${ret.deptCode}" placeholder="출발지 코드">
                <input type="text" id="edit-ret-arrCode" value="${ret.arrCode}" placeholder="도착지 코드">
                <input type="text" id="edit-ret-flightNo" value="${ret.flightNo}" placeholder="편명">
                <input type="text" id="edit-ret-date" value="${ret.date}" placeholder="날짜">
                <input type="text" id="edit-ret-deptTime" value="${ret.deptTime}" placeholder="출발 시간">
                <input type="text" id="edit-ret-arrTime" value="${ret.arrTime || ''}" placeholder="도착 시간">
                <input type="text" id="edit-ret-gate" value="${ret.gate}" placeholder="게이트">
            </div>
        `;
    } else if (type === 'rental') {
        const r = appState.rental;
        body.innerHTML = `
            <label class="label">빌리는 위치</label><input type="text" id="edit-rental-pickPlace" value="${r.pickPlace || ''}">
            <label class="label">빌리는 시간</label><input type="text" id="edit-rental-pickTime" value="${r.pickTime || ''}">
            <label class="label">반납 위치</label><input type="text" id="edit-rental-returnPlace" value="${r.returnPlace || ''}">
            <label class="label">반납 시간</label><input type="text" id="edit-rental-returnTime" value="${r.returnTime || ''}">
            <label class="label">차량 정보</label><input type="text" id="edit-rental-carInfo" value="${r.carInfo || ''}">
        `;
    } else if (type === 'stay') {
        const stay = stayId ? appState.stays.find(s => s.id == stayId) : null;
        body.innerHTML = `
            <label class="label">숙소 이름</label><input type="text" id="edit-stayName" value="${stay ? stay.name : ''}">
            <label class="label">주소</label><input type="text" id="edit-stayAddress" value="${stay ? stay.address : ''}">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><label class="label">입실 날짜</label><input type="date" id="edit-stayCheckInDate" value="${stay ? stay.checkInDate : ''}"></div>
                <div><label class="label">퇴실 날짜</label><input type="date" id="edit-stayCheckOutDate" value="${stay ? stay.checkOutDate : ''}"></div>
            </div>
        `;
    }
}

window.closeEditModal = () => document.getElementById('editModal').style.display = 'none';

window.saveEdit = () => {
    updateSyncStatus("저장 중...", "#f1c40f");
    if (currentEditType === 'title') {
        appState.tripTag = document.getElementById('edit-tripTag').value;
        appState.tripTitle = document.getElementById('edit-tripTitle').value;
        appState.tripStartDate = document.getElementById('edit-tripStartDate').value;
        appState.tripEndDate = document.getElementById('edit-tripEndDate').value;
        // 기간 계산 로직 생략 (기존 필드 유지)
    } else if (currentEditType === 'flight') {
        appState.flight.outbound.deptCode = document.getElementById('edit-out-deptCode').value;
        appState.flight.outbound.arrCode = document.getElementById('edit-out-arrCode').value;
        appState.flight.outbound.flightNo = document.getElementById('edit-out-flightNo').value;
        appState.flight.outbound.date = document.getElementById('edit-out-date').value;
        appState.flight.outbound.deptTime = document.getElementById('edit-out-deptTime').value;
        appState.flight.outbound.arrTime = document.getElementById('edit-out-arrTime').value;
        appState.flight.outbound.gate = document.getElementById('edit-out-gate').value;
        
        appState.flight.return.deptCode = document.getElementById('edit-ret-deptCode').value;
        appState.flight.return.arrCode = document.getElementById('edit-ret-arrCode').value;
        appState.flight.return.flightNo = document.getElementById('edit-ret-flightNo').value;
        appState.flight.return.date = document.getElementById('edit-ret-date').value;
        appState.flight.return.deptTime = document.getElementById('edit-ret-deptTime').value;
        appState.flight.return.arrTime = document.getElementById('edit-ret-arrTime').value;
        appState.flight.return.gate = document.getElementById('edit-ret-gate').value;
    } else if (currentEditType === 'rental') {
        appState.rental.pickPlace = document.getElementById('edit-rental-pickPlace').value;
        appState.rental.pickTime = document.getElementById('edit-rental-pickTime').value;
        appState.rental.returnPlace = document.getElementById('edit-rental-returnPlace').value;
        appState.rental.returnTime = document.getElementById('edit-rental-returnTime').value;
        appState.rental.carInfo = document.getElementById('edit-rental-carInfo').value;
    } else if (currentEditType === 'stay') {
        const stayData = {
            name: document.getElementById('edit-stayName').value,
            address: document.getElementById('edit-stayAddress').value,
            checkInDate: document.getElementById('edit-stayCheckInDate').value,
            checkOutDate: document.getElementById('edit-stayCheckOutDate').value,
        };
        if (currentStayId) {
            const idx = appState.stays.findIndex(s => s.id == currentStayId);
            appState.stays[idx] = { ...appState.stays[idx], ...stayData };
        } else {
            appState.stays.push({ id: String(Date.now()), ...stayData, subItems: [] });
        }
    }
    saveToFirebase();
    closeEditModal();
}

// --- Sub Items Logic ---
window.openAddSubModal = (stayId) => {
    currentStayId = stayId;
    document.getElementById('addSubModal').style.display = 'flex';
}
window.closeSubModal = () => document.getElementById('addSubModal').style.display = 'none';

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

window.deleteStay = (id) => {
    if(confirm('삭제하시겠습니까?')) {
        appState.stays = appState.stays.filter(s => s.id != id);
        saveToFirebase();
    }
}

// --- Firebase Sync ---
function saveToFirebase() {
    const tripId = getTripId();
    set(ref(db, 'trips/' + tripId), appState).then(() => {
        updateSyncStatus("클라우드 저장됨", "#2ecc71");
    });
}

function loadFromFirebase() {
    const tripId = getTripId();
    onValue(ref(db, 'trips/' + tripId), (snapshot) => {
        let data = snapshot.val();
        if (data) {
            data = migrateData(data);
            appState = { ...getDefaultState(), ...data };
            if(!appState.stays) appState.stays = [];
            renderAll();
        } else {
            saveToFirebase();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromFirebase();
    fetchExchangeRate();
    setInterval(fetchExchangeRate, 1000 * 60 * 10); // 10분마다 업데이트
});

window.onhashchange = () => window.location.reload();

window.onclick = (e) => {
    if(e.target.classList.contains('modal')) {
        closeEditModal();
        closeSubModal();
    }
}
