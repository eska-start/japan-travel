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
        pickTime: '10/16 09:00 AM', returnPlace: '교토역 앞 토요타 렌터카', carInfo: '토요타 야리스 (소형)'
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
    
    // 항공편 데이터 마이그레이션 (Flat -> Nested)
    if (data.flight && !data.flight.outbound) {
        console.log("Migrating old flight data format...");
        const oldFlight = { ...data.flight };
        data.flight = {
            outbound: { ...oldFlight },
            return: { ...getDefaultState().flight.return }
        };
    }
    
    // 만약 outbound는 있는데 return이 없는 경우 대비
    if (data.flight && data.flight.outbound && !data.flight.return) {
        data.flight.return = { ...getDefaultState().flight.return };
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
    if (tripId) {
        window.location.hash = tripId;
    } else {
        alert("이동할 여행 코드를 입력해 주세요!");
    }
};

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
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; color: ${color}; font-weight: 700; font-size: 0.95rem;">
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
                    <span style="font-size: 0.75rem;">${data.duration || '-'}</span>
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

    const sortedStays = [...(appState.stays || [])].sort((a, b) => {
        if (!a.checkInDate) return 1;
        if (!b.checkInDate) return -1;
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
    });

    container.innerHTML = sortedStays.map(stay => `
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
            <label class="label">상단 태그 (영문)</label><input type="text" id="edit-tripTag" value="${appState.tripTag}">
            <label class="label">여행 제목</label><input type="text" id="edit-tripTitle" value="${appState.tripTitle}">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><label class="label">시작 날짜</label><input type="date" id="edit-tripStartDate" value="${appState.tripStartDate}"></div>
                <div><label class="label">종료 날짜</label><input type="date" id="edit-tripEndDate" value="${appState.tripEndDate}"></div>
            </div>
        `;
    } else if (type === 'flight') {
        title.innerText = '항공편 정보 수정 (왕복)';
        const out = appState.flight.outbound;
        const ret = appState.flight.return;
        
        body.innerHTML = `
            <div style="background: #fff5f5; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #ffe3e3;">
                <h4 style="color: var(--primary); margin-bottom: 10px;"><i class="fas fa-plane-departure"></i> 출국편 (Outbound)</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><label class="label">출발지 코드</label><input type="text" id="edit-out-deptCode" value="${out.deptCode}"></div>
                    <div><label class="label">도착지 코드</label><input type="text" id="edit-out-arrCode" value="${out.arrCode}"></div>
                    <div><label class="label">편명</label><input type="text" id="edit-out-flightNo" value="${out.flightNo}"></div>
                    <div><label class="label">날짜</label><input type="text" id="edit-out-date" value="${out.date}"></div>
                    <div><label class="label">출발 시간</label><input type="text" id="edit-out-deptTime" value="${out.deptTime}"></div>
                    <div><label class="label">게이트</label><input type="text" id="edit-out-gate" value="${out.gate}"></div>
                </div>
            </div>
            <div style="background: #f0f7ff; padding: 15px; border-radius: 12px; border: 1px solid #e1efff;">
                <h4 style="color: #3498db; margin-bottom: 10px;"><i class="fas fa-plane-arrival"></i> 귀국편 (Return)</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><label class="label">출발지 코드</label><input type="text" id="edit-ret-deptCode" value="${ret.deptCode}"></div>
                    <div><label class="label">도착지 코드</label><input type="text" id="edit-ret-arrCode" value="${ret.arrCode}"></div>
                    <div><label class="label">편명</label><input type="text" id="edit-ret-flightNo" value="${ret.flightNo}"></div>
                    <div><label class="label">날짜</label><input type="text" id="edit-ret-date" value="${ret.date}"></div>
                    <div><label class="label">출발 시간</label><input type="text" id="edit-ret-deptTime" value="${ret.deptTime}"></div>
                    <div><label class="label">게이트</label><input type="text" id="edit-ret-gate" value="${ret.gate}"></div>
                </div>
            </div>
        `;
    } else if (type === 'rental') {
        title.innerText = '렌트카 정보 수정';
        const r = appState.rental;
        body.innerHTML = `
            <label class="label">빌리는 시간</label><input type="text" id="edit-pickTime" value="${r.pickTime}">
            <label class="label">반납 장소</label><input type="text" id="edit-returnPlace" value="${r.returnPlace}">
            <label class="label">차량 정보</label><input type="text" id="edit-carInfo" value="${r.carInfo}">
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
    if (!start || !end) return '날짜를 설정해 주세요';
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
                outbound: {
                    deptCode: document.getElementById('edit-out-deptCode').value,
                    arrCode: document.getElementById('edit-out-arrCode').value,
                    flightNo: document.getElementById('edit-out-flightNo').value,
                    date: document.getElementById('edit-out-date').value,
                    deptTime: document.getElementById('edit-out-deptTime').value,
                    gate: document.getElementById('edit-out-gate').value,
                    deptName: appState.flight.outbound.deptName,
                    arrName: appState.flight.outbound.arrName,
                    duration: appState.flight.outbound.duration
                },
                return: {
                    deptCode: document.getElementById('edit-ret-deptCode').value,
                    arrCode: document.getElementById('edit-ret-arrCode').value,
                    flightNo: document.getElementById('edit-ret-flightNo').value,
                    date: document.getElementById('edit-ret-date').value,
                    deptTime: document.getElementById('edit-ret-deptTime').value,
                    gate: document.getElementById('edit-ret-gate').value,
                    deptName: appState.flight.return.deptName,
                    arrName: appState.flight.return.arrName,
                    duration: appState.flight.return.duration
                }
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

function saveToFirebase() {
    const tripId = getTripId();
    const tripRef = ref(db, 'trips/' + tripId);
    set(tripRef, appState).then(() => {
        updateSyncStatus("클라우드 저장됨", "#2ecc71");
        setTimeout(() => updateSyncStatus("연결됨", "#2ecc71"), 3000);
    });
}

function loadFromFirebase() {
    const tripId = getTripId();
    const tripRef = ref(db, 'trips/' + tripId);

    onValue(tripRef, (snapshot) => {
        let data = snapshot.val();
        if (data) {
            data = migrateData(data);
            // Deep Merge or careful assignment
            appState = { ...getDefaultState(), ...data };
            if(!appState.stays) appState.stays = [];
            renderAll();
            updateSyncStatus("최신 데이터 수신", "#2ecc71");
        } else {
            saveToFirebase();
        }
    });
}

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

// 미사용 함수 정리 및 기타 이벤트 리스너 생략 (원본 로직 유지)
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
