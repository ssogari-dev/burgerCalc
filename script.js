/************************************************************
 * 전역 및 상위 스코프 변수/상수
 ************************************************************/

// 프랜차이즈별 CSV 데이터를 저장하는 객체
let franchiseData = {};

// 사용자가 선택한 날짜
let selectedDate = '';

// Leaflet 지도 객체
let map;

// 지도에 표시될 GeoJSON 레이어를 담을 변수
let geojsonLayer;

// 16개 행정구역(테이블 열)에 대한 정렬 상태를 저장하는 배열
// (0: 정렬 안 됨 / 1: 오름차순 / 2: 내림차순)
let sortStates = new Array(16).fill(0);

// 프랜차이즈 이름 매핑 (영문 코드 -> 한글 이름)
const franchiseNames = {
    'bgk': '버거킹',
    'kfc': 'KFC',
    'mcdonalds': '맥도날드',
    'subway': '써브웨이',
    'issac': '이삭토스트',
    'lotteria': '롯데리아',
    'momstouch': '맘스터치'
};

// 대한민국 광역시 및 특별시 목록
const metropolitanCities = ['서울', '부산', '인천', '대구', '대전', '광주', '울산'];

// 사용 가능한 날짜 목록 (데이터 폴더 구조와 연동)
const dateList = ['2024-12'];

// 지도 배경(타일) 레이어 관련 변수
let tileLayer;
let labelLayerGroup; // 지도에 표시하는 라벨들을 묶어서 관리하기 위한 LayerGroup

// 전역으로 GeoJSON 데이터를 저장해두고 재사용하기 위한 변수
// (중복 fetch 방지)
let globalGeojsonData = null;


/************************************************************
 * 초기화 관련 함수
 ************************************************************/

/**
 * 지도를 초기화하고, 지도 옵션 및 OSM 타일 사용 여부 체크박스 이벤트를 설정한다.
 */
async function initMap() {
    // Leaflet map 객체 생성
    map = L.map('map', {
        minZoom: 7,  // 최소 줌 레벨
        maxZoom: 13  // 최대 줌 레벨
    }).setView([36.5, 127.5], 8); // 지도 초기 중심좌표와 줌 레벨 설정

    // "OpenStreetMap 타일 표시" 체크박스 이벤트 리스너
    document.getElementById('showStreetMap').addEventListener('change', function (e) {
        if (e.target.checked) {
            // 체크되면 OSM 타일 레이어 추가
            tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
        } else if (tileLayer) {
            // 체크 해제되면 지도에서 타일 레이어 제거
            map.removeLayer(tileLayer);
        }
    });
}

/**
 * 지정한 CSV 파일을 로드하여 파싱하고, 배열 형태로 반환한다.
 * 
 * @param {string} filename - CSV 파일 이름(확장자 제외)
 * @returns {Array<Object>} CSV 데이터 파싱 결과
 */
async function loadCSV(filename) {
    try {
        // 현재 선택된 날짜 폴더 안의 filename.csv를 fetch
        const response = await fetch(`data/${selectedDate}/${filename}.csv`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // 응답을 텍스트로 변환
        const text = await response.text();
        // CSV를 줄 단위로 분할한 뒤, 각 줄을 콤마(,)로 분리
        const rows = text.split('\n').map(row => row.split(','));
        // CSV의 첫 번째 줄(헤더)
        const headers = rows[0];

        // 헤더 길이와 동일한 행만 남기고, 객체로 변환하여 반환
        return rows.slice(1)
            .filter(row => row.length === headers.length)
            .map(row => {
                const item = {};
                headers.forEach((header, index) => {
                    item[header.trim()] = row[index]?.trim() || '';
                });
                return item;
            });
    } catch (error) {
        console.error(`Error loading ${filename}.csv:`, error);
        return [];
    }
}

/**
 * 설정된 프랜차이즈 목록에 대해 CSV 데이터를 모두 불러온다.
 * (bgk, kfc, mcdonalds, subway, issac, lotteria, momstouch, hu)
 */
async function loadData() {
    // 기존 데이터 초기화
    franchiseData = {};
    // 'hu'는 인구(human), 면적(land) 정보가 들어있는 별도 CSV
    const franchises = ['bgk', 'kfc', 'mcdonalds', 'subway', 'issac', 'lotteria', 'momstouch', 'hu'];

    // 각 프랜차이즈별 CSV를 불러와 franchiseData에 저장
    for (const franchise of franchises) {
        franchiseData[franchise] = await loadCSV(franchise);
    }
}

/**
 * korea.geojson을 한 번만 로드하여 반환하는 함수
 */
async function fetchGeojsonData() {
    try {
        const response = await fetch('data/korea.geojson');
        return await response.json();
    } catch (error) {
        console.error('Failed to load GeoJSON:', error);
        return null;
    }
}


/************************************************************
 * 데이터 계산 / 지도 / 테이블 갱신 관련 함수
 ************************************************************/

/**
 * 특정 지역(도/시, 군/구 등)의 매장 수와 매장 상세정보를 반환한다.
 * 
 * @param {string} area - 지역명
 * @param {string} prov - 도/광역시명
 * @returns {Object} { counts, storeDetails } 형태로 반환
 */
function getStoreCounts(area, prov) {
    const counts = {};       // 프랜차이즈별 매장 수
    const storeDetails = {}; // 각 매장의 상세 정보(이름, 주소)
    // 행정구역 세분화 여부(구 단위까지 구분할지 여부)
    const separateDistrict = document.getElementById('separateDistrict')?.checked ?? true;

    // area, prov로부터 키를 만드는 함수
    function constructKey(item) {
        const normalizedArea = item.area.replace(/\s+/g, '');
        // 광역시(서울, 부산 등)는 시+구조합
        if (metropolitanCities.includes(item.prov)) {
            return `${item.prov} ${normalizedArea}`;
        }
        // separateDistrict가 false인 경우, 'XX시 YY구' 형태를 'XX시'로만 묶기
        if (!separateDistrict && normalizedArea.includes('구')) {
            const cityMatch = normalizedArea.match(/(.+?시)/);
            return cityMatch ? `${item.prov} ${cityMatch[1]}` : `${item.prov} ${normalizedArea}`;
        }
        return `${item.prov} ${normalizedArea}`;
    }

    // 현재 클릭된(또는 보여줄) 행정구역을 위한 키
    const targetKey = constructKey({ prov, area: area.replace(/\s+/g, '') });

    // 프랜차이즈 데이터를 순회하면서 targetKey와 일치하는 매장 수를 계산
    Object.entries(franchiseData).forEach(([franchise, data]) => {
        // 'hu'는 인구/면적 데이터이므로 매장 정보 계산에서 제외
        if (franchise === 'hu') return;

        // 해당 지역의 매장만 필터링
        const stores = data.filter(item => constructKey(item) === targetKey);
        counts[franchise] = stores.length;
        // 매장 상세 정보
        storeDetails[franchise] = stores.map(store => ({
            name: store.store,
            address: store.addr
        }));
    });

    // 매장 수와 매장 상세 정보를 함께 반환
    return { counts, storeDetails };
}

/**
 * 체크박스(분자, 분모) 상태에 따라 프랜차이즈 매장 데이터를 가공하여
 * 지역별 비율(ratio)을 계산한다.
 * 
 * @returns {Array<Object>} 지역별 계산 결과 배열
 */
function calculateRatios() {
    // Map을 사용하여 지역(key)별 데이터를 저장
    const regions = new Map();
    const separateDistrict = document.getElementById('separateDistrict')?.checked ?? true;

    // 화면에 표시할 지역명(시 구분 등)을 만드는 함수
    function getDisplayName(item) {
        if (metropolitanCities.includes(item.prov)) {
            return item.area; 
        }
        if (!separateDistrict && item.area.includes('구')) {
            const cityMatch = item.area.match(/(.+?시)/);
            return cityMatch ? cityMatch[1] : item.area;
        }
        return item.area;
    }

    // 지역 키를 만드는 함수 (도/광역시 + 지역명)
    function constructKey(item) {
        const normalizedArea = item.area.replace(/\s+/g, '');
        if (metropolitanCities.includes(item.prov)) {
            return `${item.prov} ${normalizedArea}`;
        }
        if (!separateDistrict && normalizedArea.includes('구')) {
            const cityMatch = normalizedArea.match(/(.+?시)/);
            return cityMatch ? `${item.prov} ${cityMatch[1]}` : `${item.prov} ${normalizedArea}`;
        }
        return `${item.prov} ${normalizedArea}`;
    }

    // 먼저 'hu'(인구/면적) 데이터를 regions Map에 넣어둔다
    franchiseData.hu.forEach(item => {
        const key = constructKey(item);
        const displayArea = getDisplayName(item);

        // 아직 해당 key가 없으면 새로 생성
        if (!regions.has(key)) {
            regions.set(key, {
                prov: item.prov,
                area: displayArea,
                // 프랜차이즈별 매장 수 기본값: 0
                counts: Object.fromEntries(Object.keys(franchiseNames).map(f => [f, 0])),
                land: 0,
                people: 0
            });
        }
        const region = regions.get(key);
        // 면적, 인구 합산
        region.land += parseFloat(item.land) || 0;
        region.people += parseFloat(item.people) || 0;
    });

    // 이후 나머지 프랜차이즈 데이터(hu 제외)로 매장 수를 regions에 누적
    Object.entries(franchiseData).forEach(([franchise, data]) => {
        if (franchise === 'hu') return; // 인구/면적 데이터는 skip
        data.forEach(item => {
            const key = constructKey(item);
            if (regions.has(key)) {
                regions.get(key).counts[franchise]++;
            }
        });
    });

    // 선택된 분자/분모(체크박스)를 이용하여 비율 계산
    const regionArray = Array.from(regions.values());
    return regionArray.map(region => {
        // 분자(체크된 프랜차이즈) 목록
        const numerators = Array.from(document.querySelectorAll('input[name="numerator"]:checked'))
            .map(checkbox => checkbox.value);
        // 분모(체크된 프랜차이즈) 목록
        const denominators = Array.from(document.querySelectorAll('input[name="denominator"]:checked'))
            .map(checkbox => checkbox.value);

        // 분자 합계
        const numeratorSum = numerators.reduce((sum, f) => sum + (region.counts[f] || 0), 0);
        // 분모 합계
        const denominatorSum = denominators.reduce((sum, f) => sum + (region.counts[f] || 0), 0);

        // 버거 비율 (버거킹+KFC+맥도날드+써브웨이) / 롯데리아
        const burgerRatio = region.counts.lotteria
            ? (region.counts.bgk + region.counts.kfc + region.counts.mcdonalds + region.counts.subway)
              / region.counts.lotteria
            : 0;

        // 지역 내 모든 프랜차이즈 매장 수 합계
        const totalCount = Object.values(region.counts).reduce((sum, c) => sum + c, 0);
        // 인구 만 명 단위 변환
        const population = region.people / 10000;

        return {
            prov: region.prov,
            area: region.area,
            counts: region.counts,
            ratio: denominatorSum === 0 ? 0 : numeratorSum / denominatorSum,
            burgerRatio, 
            totalCount,
            land: region.land,
            population,
            // 롯데리아 인구 밀도(만 명 기준)
            lotteriaPopDensity: population > 0 ? (region.counts.lotteria || 0) / population : 0,
            // 전체 프랜차이즈 매장 수 인구 밀도
            totalPopDensity: population > 0 ? totalCount / population : 0
        };
    });
}

/**
 * 지도에 표시할 면적 색깔을 결정하기 위한 함수
 * 
 * @param {number} value - 현재 지역의 비율 값
 * @param {number} minValue - 전체 지역 중 최소 비율
 * @param {number} maxValue - 전체 지역 중 최대 비율
 * @returns {string} RGB 형태의 색상값 (e.g. 'rgb(255,200,200)')
 */
function getColor(value, minValue, maxValue) {
    // minValue와 maxValue가 동일하면 계산 문제 발생 => ratio = 0 등 처리 필요
    // 여기서는 간단히 (value - min) / (max - min) 로 비율(ratio) 계산
    const ratio = (value - minValue) / (maxValue - minValue);
    // 빨간색(R)은 255 고정, G/B는 ratio에 따라 줄어드는 방식
    const r = 255;
    const g = Math.round(255 * (1 - ratio));
    const b = Math.round(255 * (1 - ratio));
    return `rgb(${r},${g},${b})`;
}

/**
 * 이미 로드된 GeoJSON 데이터를 가공(processGeojsonData)하여
 * 지도에 색칠하고, 마우스이벤트, 클릭 이벤트 등을 설정한다.
 * 
 * @param {Object} geojsonData - korean.geojson 원본 데이터
 * @param {Array<Object>} ratios - calculateRatios() 결과
 */
/**
 * 이미 로드된 GeoJSON 데이터를 가공(processGeojsonData)하여
 * 지도에 색칠하고, 마우스이벤트, 클릭 이벤트 등을 설정한다.
 * 
 * @param {Object} geojsonData - korean.geojson 원본 데이터
 * @param {Array<Object>} ratios - calculateRatios() 결과
 */
function updateMapColors(geojsonData, ratios) {
    // 기존에 그려져 있던 GeoJSON 레이어가 있으면 제거
    if (geojsonLayer) {
        map.removeLayer(geojsonLayer);
    }
    // 라벨 레이어 그룹도 새로 만들기 위해 제거
    if (labelLayerGroup) {
        map.removeLayer(labelLayerGroup);
    }
    labelLayerGroup = L.layerGroup();

    // 유효한 비율(분모=0이 아닌 지역)만 추출
    const validRatios = ratios.filter(r => r.ratio > 0);
    const minValue = validRatios.length > 0 ? Math.min(...validRatios.map(r => r.ratio)) : 0;
    const maxValue = validRatios.length > 0 ? Math.max(...validRatios.map(r => r.ratio)) : 0;

    // 지도 표시 옵션(테두리, 라벨, 불투명도) 읽어오기
    const showBorders = document.getElementById('showBorders').checked;
    const showLabels = document.getElementById('showLabels').checked;
    const opacity = document.getElementById('mapOpacity').value / 100;

    // 좌측 표시창에 최소값/최대값 표시
    document.getElementById('min-value').textContent = minValue.toFixed(2);
    document.getElementById('max-value').textContent = maxValue.toFixed(2);

    // GeoJSON 데이터를 processGeojsonData로 가공
    const processedGeojson = processGeojsonData(geojsonData);

    // 실제 지도에 GeoJSON 레이어 생성
    geojsonLayer = L.geoJSON(processedGeojson, {
        // 스타일 지정
        style: function (feature) {
            // feature.properties.sig_cd => 행정코드
            const huData = franchiseData.hu.find(item => item.sig_cd === feature.properties.sig_cd);
            const region = ratios.find(r =>
                huData && r.area === huData.area && r.prov === huData.prov
            );

            // ratio 값에 따른 색상 결정 (minValue == maxValue이면 흰색 처리)
            let fillCol = '#ffffff';
            if (region && minValue !== maxValue) {
                fillCol = getColor(region.ratio, minValue, maxValue);
            }

            return {
                fillColor: fillCol,         // 영역 색상
                weight: showBorders ? 1 : 0,// 테두리 두께 (showBorders 체크에 따라)
                color: '#666',              // 테두리 색
                opacity: 1,
                fillOpacity: opacity        // 채우기 불투명도
            };
        },
        // 각 지역(feature)에 대한 이벤트 지정
        onEachFeature: function (feature, layer) {
            layer.on({
                // 마우스 오버 시 스타일 변경
                mouseover: function (e) {
                    const targetLayer = e.target;
                    targetLayer.setStyle({
                        weight: showBorders ? 2 : 0,      // 테두리 두께를 살짝 두껍게
                        color: '#333',
                        fillOpacity: Math.min(0.9, opacity + 0.2) 
                    });
                },
                // 마우스가 벗어날 때 스타일 복원
                mouseout: function (e) {
                    geojsonLayer.resetStyle(e.target);
                },
                // 영역 클릭 시 상세 정보 모달 표시
                click: function (e) {
                    // GeoJSON 객체의 행정코드로부터 해당 지역의 인구/면적 데이터를 찾음
                    const huData = franchiseData.hu.find(item => 
                        item.sig_cd === feature.properties.sig_cd
                    );
                    // 찾은 지역 데이터로부터 계산된 비율 정보를 찾음
                    const region = ratios.find(r =>
                        huData && r.area === huData.area && r.prov === huData.prov
                    );
                    
                    // 지역 정보가 있으면 모달 표시를 위한 가상의 테이블 행을 생성
                    if (region) {
                        const mockRow = {
                            cells: [
                                { textContent: region.prov },             // 도/광역시
                                { textContent: region.area },             // 지역명
                                { textContent: region.ratio.toFixed(2) }, // 계산된 비율
                                { textContent: region.counts.bgk || 0 },  // 버거킹 매장 수
                                { textContent: region.counts.kfc || 0 },  // KFC 매장 수
                                { textContent: region.counts.mcdonalds || 0 }, // 맥도날드 매장 수
                                { textContent: region.counts.subway || 0 },    // 써브웨이 매장 수
                                { textContent: region.counts.issac || 0 },     // 이삭 매장 수
                                { textContent: region.counts.lotteria || 0 },  // 롯데리아 매장 수
                                { textContent: region.counts.momstouch || 0 }, // 맘스터치 매장 수
                                { textContent: region.burgerRatio.toFixed(2) }, // 버거 비율
                                { textContent: region.totalCount },            // 전체 매장 수
                                { textContent: region.land.toFixed(2) },       // 면적
                                { textContent: region.population.toFixed(1) }, // 인구(만 명)
                                { textContent: region.lotteriaPopDensity.toFixed(2) }, // 롯데리아 인구 밀도
                                { textContent: region.totalPopDensity.toFixed(2) }    // 전체 인구 밀도
                            ]
                        };
                        showDetails(mockRow);
                    }
                }
            });

            // 툴팁 바인딩(지역명, 비율)
            const huData = franchiseData.hu.find(item =>
                item.sig_cd === feature.properties.sig_cd
            );
            const region = ratios.find(r =>
                huData && r.area === huData.area && r.prov === huData.prov
            );
            layer.bindTooltip(
                `${feature.properties.name}<br>비율: ${region ? region.ratio.toFixed(2) : 'N/A'}`,
                { sticky: true } 
            );

            // showLabels가 체크되어 있으면, 지도 중앙에 라벨 추가
            if (showLabels) {
                const center = layer.getBounds().getCenter();
                const areaLabel = L.marker(center, {
                    icon: L.divIcon({
                        className: 'map-label',
                        html: `<span>${feature.properties.SIG_KOR_NM}</span>`
                    })
                });
                labelLayerGroup.addLayer(areaLabel);
            }
        }
    }).addTo(map);

    // 라벨이 켜져 있을 경우 라벨 레이어 추가
    if (showLabels) {
        labelLayerGroup.addTo(map);
    }
}

/**
 * 테이블 부분을 갱신하고, 좌측 상단에 최소/최대/평균값을 표시한다.
 * @param {Array<Object>} ratios - calculateRatios() 결과
 */
function updateTable(ratios) {
    // 유효한 비율(ratio>0)만 추출하여 통계 계산
    const validRatios = ratios.filter(r => r.ratio > 0);
    const stats = {
        min: validRatios.length > 0 ? Math.min(...validRatios.map(r => r.ratio)) : 0,
        max: validRatios.length > 0 ? Math.max(...validRatios.map(r => r.ratio)) : 0,
        avg: validRatios.length > 0
            ? validRatios.reduce((sum, r) => sum + r.ratio, 0) / validRatios.length
            : 0
    };

    // 통계 값 표시
    document.getElementById('statistics').innerHTML = `
        <p>최소값: ${stats.min.toFixed(2)} / 최대값: ${stats.max.toFixed(2)} / 평균값: ${stats.avg.toFixed(2)}</p>
    `;

    // sortData()를 통해 현재 정렬 상태에 맞춰 데이터 정렬
    const sortedRatios = sortData(ratios);

    // 테이블 tbody 갱신
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = sortedRatios.map(d => `
        <tr>
            <td class="primary-column">${d.prov}</td>
            <td class="primary-column">${d.area}</td>
            <td class="primary-column">${d.ratio.toFixed(2)}</td>
            <td class="secondary-column">${d.counts.bgk || 0}</td>
            <td class="secondary-column">${d.counts.kfc || 0}</td>
            <td class="secondary-column">${d.counts.mcdonalds || 0}</td>
            <td class="secondary-column">${d.counts.subway || 0}</td>
            <td class="secondary-column">${d.counts.issac || 0}</td>
            <td class="secondary-column">${d.counts.lotteria || 0}</td>
            <td class="secondary-column">${d.counts.momstouch || 0}</td>
            <td class="secondary-column">${d.burgerRatio.toFixed(2)}</td>
            <td class="secondary-column">${d.totalCount}</td>
            <td class="secondary-column">${d.land.toFixed(2)}</td>
            <td class="secondary-column">${d.population.toFixed(1)}</td>
            <td class="secondary-column">${d.lotteriaPopDensity.toFixed(2)}</td>
            <td class="secondary-column">${d.totalPopDensity.toFixed(2)}</td>
        </tr>
    `).join('');
}

/**
 * GeoJSON 데이터를 활용하여, feature.properties 에 sig_cd 등을 매핑해주는 함수
 * @param {Object} geojsonData - 원본 korea.geojson
 * @returns {Object} 가공된 GeoJSON
 */
function processGeojsonData(geojsonData) {
    return {
        ...geojsonData,
        features: geojsonData.features.map(feature => {
            const sigCd = feature.properties.SIG_CD;
            const huData = franchiseData.hu.find(item => item.sig_cd === sigCd);
            const areaName = feature.properties.SIG_KOR_NM; 
            const sidonm = huData ? huData.prov : '';

            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    // 예: "서울 종로구" 형태로 표시
                    name: `${sidonm} ${areaName}`,
                    normalized_area: areaName,
                    sig_cd: sigCd
                }
            };
        })
    };
}


/************************************************************
 * 상세 정보 모달 관련
 ************************************************************/

/**
 * 테이블에서 특정 지역을 클릭했을 때 모달을 띄워 상세 정보를 보여준다.
 * @param {HTMLTableRowElement} row - 클릭된 테이블 행
 */
function showDetails(row) {
    // row.cells[x]로부터 지역명, 도/광역시명, 비율, 면적값 등을 파싱
    const area = row.cells[1].textContent;
    const prov = row.cells[0].textContent;
    const ratio = parseFloat(row.cells[2].textContent);
    const land = parseFloat(row.cells[12].textContent);

    // hu 데이터에서 인구 값을 찾는다
    const regionData = franchiseData.hu.find(item =>
        item.prov === prov && item.area === area
    );
    const population = regionData ? parseFloat(regionData.people) : 0;

    // 해당 지역의 매장 수 및 매장 상세 정보를 가져온다
    const { counts } = getStoreCounts(area, prov);

    // 모달 요소들
    const modal = document.getElementById('detail-modal');
    const modalContent = document.getElementById('modal-content');

    // 분자/분모 체크박스 정보를 수집
    const allNumerators = Array.from(document.querySelectorAll('input[name="numerator"]'))
        .map(checkbox => ({
            value: checkbox.value,
            checked: checkbox.checked
        }));
    const allDenominators = Array.from(document.querySelectorAll('input[name="denominator"]'))
        .map(checkbox => ({
            value: checkbox.value,
            checked: checkbox.checked
        }));

    // 모달 내부 HTML 구성
    modalContent.innerHTML = `
        <span class="close">&times;</span>
        <div class="detail-header">
            <h2>${prov} ${area}</h2>
        </div>

        <div class="region-info">
            <div class="info-item">
                <span class="info-label">면적</span>
                <span class="info-value">${land.toFixed(2)} km²</span>
            </div>
            <div class="info-item">
                <span class="info-label">인구</span>
                <span class="info-value">${population.toLocaleString()} 명</span>
            </div>
        </div>

        <div class="franchise-section">
            <h3>분자 항목 (비율: ${ratio.toFixed(2)})</h3>
            ${allNumerators.map(({ value: franchise, checked }) => `
                <div class="franchise-item">
                    <span class="franchise-count ${checked ? '' : 'disabled'}"
                          data-franchise="${franchise}"
                          onclick="handleStoreClick(this)">
                        ${franchiseNames[franchise]}: ${counts[franchise] || 0}개
                    </span>
                    <div class="store-list" style="display:none;"></div>
                </div>
            `).join('')}
        </div>

        <div class="franchise-section">
            <h3>분모 항목</h3>
            ${allDenominators.map(({ value: franchise, checked }) => `
                <div class="franchise-item">
                    <span class="franchise-count ${checked ? '' : 'disabled'}"
                          data-franchise="${franchise}"
                          onclick="handleStoreClick(this)">
                        ${franchiseNames[franchise]}: ${counts[franchise] || 0}개
                    </span>
                    <div class="store-list" style="display:none;"></div>
                </div>
            `).join('')}
        </div>
    `;

    // 모달 표시
    modal.style.display = 'block';

    // 모달 닫기 버튼(X 버튼) 클릭 시 숨김
    modalContent.querySelector('.close').onclick = () => {
        modal.style.display = 'none';
    };
}

/**
 * 모달 내에서 프랜차이즈 매장 숫자를 클릭했을 때,
 * 매장 목록(이름, 주소)을 토글(열고 닫기)하는 함수
 * 
 * @param {HTMLElement} element - 클릭된 <span class="franchise-count"> 요소
 */
function handleStoreClick(element) {
    // 만약 disabled 클래스가 있으면(체크 안 된 항목) 동작 안 함
    if (element.classList.contains('disabled')) return;

    // 어떤 프랜차이즈인지 data-franchise 속성에서 읽어옴
    const franchise = element.getAttribute('data-franchise');
    // 모달 제목에서 도/광역시와 지역명을 추출
    const modalTitle = document.querySelector('#detail-modal .detail-header h2').textContent;
    const [prov, area] = modalTitle.split(' ');

    // 해당 지역의 매장 상세 정보 가져오기
    const { storeDetails } = getStoreCounts(area, prov);

    // 바로 뒤에 있는 <div class="store-list"> 요소를 찾아 표시/숨김 토글
    const storeListEl = element.nextElementSibling;

    if (!storeListEl.style.display || storeListEl.style.display === 'none') {
        storeListEl.style.display = 'block';
        storeListEl.innerHTML = `
            <ul style="list-style: none; padding: 0; margin: 10px 0;">
                ${storeDetails[franchise].map(store => `
                    <li style="padding: 5px 0; border-bottom: 1px solid #ddd;">
                        <strong>${store.name}</strong><br>
                        ${store.address}
                    </li>
                `).join('')}
            </ul>
        `;
    } else {
        storeListEl.style.display = 'none';
    }
}


/************************************************************
 * 정렬 함수
 ************************************************************/

/**
 * 현재 sortStates 배열에 따라 데이터를 정렬하는 함수
 * 
 * @param {Array<Object>} data - 정렬할 지역 데이터(비율 계산 결과)
 * @returns {Array<Object>} 정렬된 데이터
 */
function sortData(data) {
    // sortStates 중 0이 아닌 index(즉 정렬 컬럼)을 찾는다
    const columnIndex = sortStates.findIndex(state => state !== 0);
    if (columnIndex === -1) return data; // 정렬 상태가 없으면 원본 그대로 반환

    // 오름차순(1)인지 내림차순(2)인지 판별
    const sortDirection = sortStates[columnIndex] === 1 ? 1 : -1;

    // 데이터 사본을 만들어 sort
    return [...data].sort((a, b) => {
        switch (columnIndex) {
            case 0: return sortDirection * a.prov.localeCompare(b.prov);
            case 1: return sortDirection * a.area.replace(/\s+/g, '').localeCompare(b.area.replace(/\s+/g, ''));
            case 2: return sortDirection * (a.ratio - b.ratio);
            case 3: return sortDirection * ((a.counts.bgk || 0) - (b.counts.bgk || 0));
            case 4: return sortDirection * ((a.counts.kfc || 0) - (b.counts.kfc || 0));
            case 5: return sortDirection * ((a.counts.mcdonalds || 0) - (b.counts.mcdonalds || 0));
            case 6: return sortDirection * ((a.counts.subway || 0) - (b.counts.subway || 0));
            case 7: return sortDirection * ((a.counts.issac || 0) - (b.counts.issac || 0));
            case 8: return sortDirection * ((a.counts.lotteria || 0) - (b.counts.lotteria || 0));
            case 9: return sortDirection * ((a.counts.momstouch || 0) - (b.counts.momstouch || 0));
            case 10: return sortDirection * (a.burgerRatio - b.burgerRatio);
            case 11: return sortDirection * (a.totalCount - b.totalCount);
            case 12: return sortDirection * (a.land - b.land);
            case 13: return sortDirection * (a.population - b.population);
            case 14: return sortDirection * (a.lotteriaPopDensity - b.lotteriaPopDensity);
            case 15: return sortDirection * (a.totalPopDensity - b.totalPopDensity);
            default: return 0;
        }
    });
}


/************************************************************
 * 이벤트 리스너 처리 & UI 갱신 통합 함수
 ************************************************************/

/**
 * 테이블과 지도(비율 색칠)를 함께 갱신하는 함수
 * - calculateRatios() 한 번만 호출
 * - 이후 updateTable(ratios), updateMapColors(globalGeojsonData, ratios)
 */
function refreshDisplay() {
    // 1) 비율(통계) 계산
    const ratios = calculateRatios();

    // 2) 테이블 갱신
    updateTable(ratios);

    // 3) 지도 갱신 (전역에 저장된 GeoJSON 데이터 재활용)
    if (globalGeojsonData) {
        updateMapColors(globalGeojsonData, ratios);
    }
}

/**
 * 지도 스타일(테두리, 라벨, 투명도)이 바뀔 때 처리하는 함수
 * - 결국 refreshDisplay()를 호출해 지도 및 테이블을 다시 그림
 */
function handleMapStyleChange() {
    refreshDisplay();
}

/**
 * 각종 DOM 이벤트를 설정하는 함수
 * - 테이블 헤더 클릭(정렬), 체크박스 변경, 슬라이더 변경, 등등
 */
function setupEventListeners() {
    // (1) 테이블 헤더 클릭 시 정렬 상태 업데이트
    document.querySelectorAll('#data-table th').forEach((header, index) => {
        header.addEventListener('click', () => {
            // 다른 컬럼의 정렬 상태는 0으로 초기화
            document.querySelectorAll('#data-table th').forEach((h, i) => {
                if (i !== index) {
                    h.classList.remove('sort-asc', 'sort-desc');
                    sortStates[i] = 0;
                }
            });

            // 현재 컬럼은 (0 -> 1 -> 2) 로 로테이션
            sortStates[index] = (sortStates[index] + 1) % 3;
            // 클래스 셋팅
            header.classList.remove('sort-asc', 'sort-desc');
            if (sortStates[index] === 1) header.classList.add('sort-asc');
            if (sortStates[index] === 2) header.classList.add('sort-desc');

            // 정렬 후 테이블/지도 갱신
            refreshDisplay();
        });
    });

    // (2) 모달 닫기 버튼(기본)
    document.querySelector('.close').onclick = () => {
        document.getElementById('detail-modal').style.display = 'none';
    };

    // (3) 테이블 행을 클릭 시 상세 정보 모달 표시
    document.querySelector('#data-table tbody').addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (row) showDetails(row);
    });

    // (4) 체크박스 상태(분자/분모, 지도 표시옵션 등)가 바뀔 때 갱신
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', refreshDisplay);
    });

    // (5) 날짜 선택 이벤트
    const selector = document.getElementById('dateSelector');
    dateList.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        selector.appendChild(option);
    });
    // 초기값 설정
    selectedDate = dateList[0];
    selector.value = selectedDate;

    // 날짜 변경 시 데이터 로드 후 다시 표시
    selector.addEventListener('change', async (e) => {
        selectedDate = e.target.value;
        await loadData();    // 새로운 날짜의 CSV 재로드
        refreshDisplay();    // 화면 갱신
    });

    // (6) 모달 바깥 영역 클릭 시 닫기
    window.onclick = (event) => {
        const modal = document.getElementById('detail-modal');
        const modal2 = document.getElementById('help-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        } else if (event.target === modal2) {
            modal2.style.display = 'none';
        }
    };

    // (7) 지도 투명도 슬라이더 변경
    const opacitySlider = document.getElementById('mapOpacity');
    const opacityValue = document.getElementById('opacityValue');
    opacitySlider.addEventListener('input', function (e) {
        const value = e.target.value;
        opacityValue.textContent = `${value}%`; 
        // 지도 스타일 변경 처리
        handleMapStyleChange();
    });

    // (8) 지도 라벨 표시 토글
    document.getElementById('showLabels').addEventListener('change', handleMapStyleChange);

    // (9) 지도 테두리 표시 토글
    document.getElementById('showBorders').addEventListener('change', handleMapStyleChange);
}


/************************************************************
 * 공지사항 / 도움말 모달
 ************************************************************/

/**
 * 공지사항 모달 닫기 (하루 동안 보지 않기 옵션 포함)
 * @param {boolean} hideForDay - true면 localStorage에 숨김 시간 기록
 */
function closeNotice(hideForDay) {
    if (hideForDay) {
        const now = new Date();
        // 오늘 날짜 +1일(자정 기준)
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        // localStorage에 만료 시점을 기록
        localStorage.setItem('hideNoticeUntil', tomorrow.getTime().toString());
    }
    // 모달 숨기기
    document.getElementById('notice-modal').style.display = 'none';
}

/**
 * 공지사항 모달을 표시한다. (이미 "하루 숨김" 상태인지 확인)
 */
async function showNotice() {
    // localStorage에 숨김 만료 시점이 있는지 확인
    const hideUntil = localStorage.getItem('hideNoticeUntil');
    const now = new Date().getTime();
    if (hideUntil && parseInt(hideUntil) > now) {
        // 아직 만료 시간이 지나지 않았다면 표시하지 않고 종료
        return;
    }

    try {
        // 공지사항 파일(예: notice.txt) 로드
        const response = await fetch('data/notice.txt?t=' + now);
        if (!response.ok) throw new Error('Notice file not found');

        // 텍스트 내용 읽어서 모달에 삽입
        const text = await response.text();
        document.getElementById('notice-content').innerHTML = text;
        document.getElementById('notice-modal').style.display = 'block';

        // 버튼(닫기, 하루 동안 보지 않기) 표시
        const closeButtons = document.querySelector('.notice-buttons');
        closeButtons.innerHTML = `
            <button class="notice-button" onclick="closeNotice(false)">닫기</button>
            <button class="notice-button" onclick="closeNotice(true)">하루 동안 보지 않기</button>
        `;
    } catch (error) {
        console.error('Failed to load notice:', error);
    }
}

/**
 * 도움말 모달 표시 함수
 * (실제 내용은 help-content에 삽입)
 */
function showHelp() {
    // 실제 도움말 내용을 HTML 문자열로 작성
    document.getElementById('help-content').innerHTML = `
        <div style="text-align:center;">
            <img src="tw.png" style="width: 500px;">
          </div>
          <div style="margin-top: 20px;">
            도심지나 번화가에 주로 위치한 버거킹, 맥도날드, KFC의 점포 수를 전국 어디에나 분포한 롯데리아의 점포 수로 나누면 한 도시의 발전 수준이 나온다는 2014년의 트윗에서 시작해, 여러 데이터 분석가 분들께서 다양한 자료를 만들어주셨습니다.<br><br>
            
            흔히 알려진 지도는 2020년, 그로부터 지금까지 행정구역의 변화도 생기고 또 다양한 프랜차이즈가 나타났습니다. 그래서 다시 만들어보자 생각했습니다.<br><br>
      
            2025년에 맞게, 맘스터치와 써브웨이를 더하고, 사용자가 직접 계산 요소를 덧붙이거나 제외하여 데이터를 분석할 수 있는 사이트를 만들었습니다.<br><br>
      
            사용법은 간단합니다.<br>
            <b>
            1. 계산에 포함시킬 프랜차이즈를 선택하여 주십시오.<br>  
            2. 선택한 항목을 포함하여 계산된 값은 아래 표의 '비율'에 표시됩니다.<br>
            3. 계산된 값에 따라 좌측 지도의 색이 바뀝니다.<br>
            </b>
            <br>
            사이트 내 정보 오류, 수정 요청이나 버그 제보는 <a href="https://github.com/ssogari-dev/burgerCalc" target="_blank">Github Issue</a> 또는 <a href="mailto:admin@ssogari.dev" target="_blank">이메일(admin at ssogari dot dev)</a>로 보내주시면 조치하겠습니다.
            <br><br>
            이 사이트의 데이터베이스를 수집하는 데 사용된 크롤링 도구와 웹 사이트 코드는 Github에서 확인하실 수 있습니다. Claude 3 Opus와 Claude 3.5 Sonnet의 도움을 받아 사이트를 제작하였습니다.<br><br>
            <br><br>
            <hr>
      
            사이트를 제작하는 데 도움을 받거나 참고한 사이트입니다.<br>
            <ul>
                <li><a href="https://neurowhai.tistory.com/350" target="_blank">NeuroWhAI 블로그</a> / 대한민국 행정구역 GeoJSON 제공<br></li>
                <li><a href="https://porimp.tistory.com/entry/%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%B6%84%EC%84%9D-2020%EB%85%84%EB%8F%84-%EB%B2%84%EA%B1%B0%EC%A7%80%EC%88%98-%EB%A7%8C%EB%93%A4%EA%B8%B01" target="_blank">Porimp님 블로그</a> / 2020년 버거지수 만들기 포스트<br></li>
                <li><a href="https://blog.naver.com/idjoopal/221513074069" target="_blank">idjoopal님 블로그</a> / 2019년 버거지수 만들기 포스트<br></li>
                <li><a href="https://nbviewer.org/gist/hyeshik/cf9f3d7686e07eedbfda" target="_blank">Hyeshik님 Jupyter</a> / 버거지수 관련 포스트<br></li>
                <li><a href="https://x.com/dotch_gahyoun/status/1881735211781923251" target="_blank">Gahyoun Gim님 트윗</a> / 공공데이터 상가 정보 조언<br></li>
                <li><a href="https://www.data.go.kr/data/15083033/fileData.do" target="_blank">소상공인시장진흥공단 상가정보 데이터</a><br></li>
                <li><a href="https://github.com/vuski/admdongkor" target="_blank">대한민국 행정동 경계 파일</a><br></li>
                <li><a href="https://x.com/10032_misaka/status/1881688726830710913" target="_blank">미코토님 트윗</a> / 롯데리아 데이터 크롤링 조언<br></li>
                <li><a href="https://www.geoservice.co.kr/" target="_blank">GEOSERVICE</a><br></li>
                <li><a href="blog.naver.com/janghanui/222390360384" target="_blank">하늬님 블로그</a> / 행정구역 시도 정보 포스트<br></li>
            </ul>
          </div>

    `;
    document.getElementById('help-modal').style.display = 'block';
}

// 도움말 버튼에 이벤트 연결
document.getElementById('helpBtn').addEventListener('click', showHelp);

// 도움말 모달의 닫기(X) 버튼 이벤트
document.querySelector('#help-modal .close').addEventListener('click', () => {
    document.getElementById('help-modal').style.display = 'none';
});


/************************************************************
 * 페이지 로드 시점의 초기화
 ************************************************************/

document.addEventListener('DOMContentLoaded', async () => {
    const selector = document.getElementById('dateSelector');
    dateList.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        selector.appendChild(option);
    });
    
    selectedDate = dateList[0];
    selector.value = selectedDate;

    // 1) 지도를 초기화 (Leaflet map 생성)
    await initMap();

    // 2) CSV 데이터 로드 (기본 selectedDate 사용)
    await loadData();

    // 3) korea.geojson을 fetch하여 globalGeojsonData에 저장 (한 번만)
    globalGeojsonData = await fetchGeojsonData();

    // 4) 이벤트 리스너를 설정
    setupEventListeners();

    // 5) 계산 + 테이블/지도 표시
    refreshDisplay();

    // 6) 공지사항 모달 표시(하루 동안 숨김 체크 포함)
    showNotice();
});
