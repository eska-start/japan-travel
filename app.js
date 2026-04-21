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

// --- Map Initialization ---
let map = null;
let mapMarkers = [];
let mapPolyline = null;

function initMap() {
    if (map) return;
    map = L.map('map').setView([35.6895, 139.6917], 10); // 기본 도쿄 중심
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

// 번호 매겨진 마커 아이콘 생성
function createNumberedIcon(number) {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #ff4757; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 14px;">${number}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

// 주소로 좌표 찾기 (Geocoding)
async function geocodeAddress(address) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
    } catch (e) {
        console.error("Geocoding error:", e);
    }
    return null;
}

// 지도 동선 업데이트
async function updateMapRoute() {
    if (!map) initMap();
    
    // 기존 마커 및 선 제거
    mapMarkers.forEach(m => map.removeLayer(m));
    if (mapPolyline) map.removeLayer(mapPolyline);
    mapMarkers = [];
    
    const sortedStays = [...(appState.stays || [])].sort((a, b) => {
        if (!a.checkInDate) return 1;
        if (!b.checkInDate) return -1;
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
    });

    const routeCoords = [];
    
    for (let i = 0; i < sortedStays.length; i++) {
        const stay = sortedStays[i];
        const addr = stay.address || stay.name;
        if (!addr) continue;

        const coords = await geocodeAddress(addr);
        if (coords) {
            routeCoords.push(coords);
            const marker = L.marker(coords, { icon: createNumberedIcon(i + 1) })
                .addTo(map)
                .bindPopup(`<b>${i + 1}. ${stay.name}</b><br>${stay.checkInDate || ''}`);
            mapMarkers.push(marker);
        }
    }

    if (routeCoords.length > 1) {
        mapPolyline = L.polyline(routeCoords, {
            color: '#ff4757',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(map);
        
        map.fitBounds(L.featureGroup(mapMarkers).getBounds(), { padding: [50, 50] });
    } else if (routeCoords.length === 1) {
        map.setView(routeCoords[0], 13);
    }
}

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

function migrateData(data) {
    if (!data) return data;
    if (data.flight && !data.flight.outbound) {
        const oldFlight = { ...data.flight };
        data.flight = {
            outbound: { ...oldFlight },
            return: { ...getDefaultState().flight.return }
        };
    }
    if (data.flight && data.flight.outbound && !data.flight.return) {
        data.flight.return = { ...getDefaultState().flight.return };
    }
    return data;
}

window.joinTripMain = () => {
    const input = document.getElementById('main-trip-id-input');
    const tripId = input.value.trim();
    if (tripId) window.location.hash = tripId;
};

function renderAll() {
    renderTitle();
    renderFlight();
    renderRental();
    renderStays();
    updateMapRoute(); // 지도 업데이트 호출
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
                    <div class="airport-code">${data.deptCode || '-'}</div>
                    <div class="time">${data.deptTime || '-'}</div>
                </div>
                <div class="flight-path">
                    <div class="plane-icon" style="background: transparent;"><i class="fas fa-plane" style="color: ${color}"></i></div>
                </div>
                <div class="arrival">
                    <div class="airport-code">${data.arrCode || '-'}</div>
                    <div class="time">${data.arrTime || '-'}</div>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 20px;">${flightCard('출국편', out, 'fa-plane-departure', 'var(--primary)')}${flightCard('귀국편', ret, 'fa-plane-arrival', '#3498db')}</div>`;
}

function renderRental() {
    const r = appState.rental;
    const container = document.getElementById('rental-display');
    if(!container) return;
    container.innerHTML = `<div class="info-item"><span class="label">렌트카</span><span class="value">${r.carInfo} (${r.pickTime})</span></div>`;
}

function renderStays() {
    const container = document.getElementById('stay-container');
    if(!container) return;
    const sortedStays = [...(appState.stays || [])].sort((a, b) => {
        if (!a.checkInDate) return 1;
        if (!b.checkInDate) return -1;
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
    });
    container.innerHTML = sortedStays.map((stay, idx) => `
        <div class="card" style="margin-bottom: 15px;">
            <div class="flex-between">
                <div>
                    <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 5px; font-size: 0.8rem; margin-right: 8px;">${idx + 1}</span>
                    <strong>${stay.name}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-sub);">${stay.address || ''}</p>
                </div>
                <div style="text-align: right; font-size: 0.8rem;">
                    <p>${stay.checkInDate || '-'}</p>
                    <div style="margin-top: 5px;">
                        <i class="fas fa-edit" style="cursor: pointer; margin-right: 10px;" onclick="openEditModal('stay', '${stay.id}')"></i>
                        <i class="fas fa-trash" style="cursor: pointer; color: #ff7675;" onclick="deleteStay('${stay.id}')"></i>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

window.openEditModal = (type, stayId = null) => {
    currentEditType = type;
    currentStayId = stayId;
    document.getElementById('editModal').style.display = 'flex';
    const body = document.getElementById('modalBody');
    body.innerHTML = '';
    if (type === 'stay') {
        const stay = stayId ? appState.stays.find(s => s.id == stayId) : null;
        body.innerHTML = `
            <label class="label">숙소명</label><input type="text" id="edit-stayName" value="${stay ? stay.name : ''}">
            <label class="label">주소</label><input type="text" id="edit-stayAddress" value="${stay ? stay.address : ''}">
            <label class="label">입실일</label><input type="date" id="edit-stayCheckInDate" value="${stay ? stay.checkInDate : ''}">
        `;
    } else if (type === 'flight') {
        const out = appState.flight.outbound;
        const ret = appState.flight.return;
        body.innerHTML = `
            <h4 style="margin-bottom: 10px; color: var(--primary);">출국편</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input type="text" id="edit-out-deptCode" value="${out.deptCode}" placeholder="출발지">
                <input type="text" id="edit-out-arrCode" value="${out.arrCode}" placeholder="도착지">
                <input type="text" id="edit-out-deptTime" value="${out.deptTime}" placeholder="시간">
            </div>
            <h4 style="margin: 15px 0 10px; color: #3498db;">귀국편</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input type="text" id="edit-ret-deptCode" value="${ret.deptCode}" placeholder="출발지">
                <input type="text" id="edit-ret-arrCode" value="${ret.arrCode}" placeholder="도착지">
                <input type="text" id="edit-ret-deptTime" value="${ret.deptTime}" placeholder="시간">
            </div>
        `;
    } else if (type === 'title') {
        body.innerHTML = `<input type="text" id="edit-tripTitle" value="${appState.tripTitle}">`;
    }
}

window.saveEdit = () => {
    if (currentEditType === 'stay') {
        const stayData = {
            name: document.getElementById('edit-stayName').value,
            address: document.getElementById('edit-stayAddress').value,
            checkInDate: document.getElementById('edit-stayCheckInDate').value
        };
        if (currentStayId) {
            const idx = appState.stays.findIndex(s => s.id == currentStayId);
            appState.stays[idx] = { ...appState.stays[idx], ...stayData };
        } else {
            appState.stays.push({ id: String(Date.now()), ...stayData });
        }
    } else if (currentEditType === 'flight') {
        appState.flight.outbound.deptCode = document.getElementById('edit-out-deptCode').value;
        appState.flight.outbound.arrCode = document.getElementById('edit-out-arrCode').value;
        appState.flight.outbound.deptTime = document.getElementById('edit-out-deptTime').value;
        appState.flight.return.deptCode = document.getElementById('edit-ret-deptCode').value;
        appState.flight.return.arrCode = document.getElementById('edit-ret-arrCode').value;
        appState.flight.return.deptTime = document.getElementById('edit-ret-deptTime').value;
    } else if (currentEditType === 'title') {
        appState.tripTitle = document.getElementById('edit-tripTitle').value;
    }
    saveToFirebase();
    document.getElementById('editModal').style.display = 'none';
}

function saveToFirebase() {
    const tripId = getTripId();
    set(ref(db, 'trips/' + tripId), appState);
}

function loadFromFirebase() {
    const tripId = getTripId();
    onValue(ref(db, 'trips/' + tripId), (snapshot) => {
        let data = snapshot.val();
        if (data) {
            data = migrateData(data);
            appState = { ...getDefaultState(), ...data };
            renderAll();
        } else {
            saveToFirebase();
        }
    });
}

window.deleteStay = (id) => {
    if (confirm('삭제하시겠습니까?')) {
        appState.stays = appState.stays.filter(s => s.id != id);
        saveToFirebase();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromFirebase();
});

window.onhashchange = () => { window.location.reload(); };
window.closeEditModal = () => { document.getElementById('editModal').style.display = 'none'; };
