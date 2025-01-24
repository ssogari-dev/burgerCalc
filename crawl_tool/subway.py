import requests
import json
import csv

# 상수 정의
URL = "https://www.subway.co.kr/ajaxStoreSearch"
CSV_FILE = "subway_stores.csv"
KOREAN_REGIONS = [
    "가평", "강릉", "강진", "거제", "거창", "계룡", "고령", "고성", "고성", "고양",
    "고흥", "곡성", "공주", "광명", "광양", "광주", "광주", "구례", "구리", "구미",
    "군산", "군위", "군포", "금산", "김제", "김천", "김포", "김해", "나주", "남양",
    "남해", "남원", "논산", "대구", "대전", "동두", "동해", "마산", "목포", "무안",
    "무주", "문경", "밀양", "보령", "보성", "보은", "부산", "부여", "부천", "분당",
    "사천", "산청", "삼척", "상주", "서귀", "서산", "서울", "서천", "성남", "성주",
    "세종", "속초", "수원", "순천", "순창", "시흥", "아산", "안산", "안성", "안양",
    "안동", "양구", "양산", "양주", "양평", "여수", "여주", "연천", "영광", "영덕",
    "영동", "영암", "영양", "영월", "영주", "영천", "예산", "예천", "오산", "옥천",
    "용인", "울릉", "울산", "울진", "원주", "음성", "의령", "의성", "의정부", "이천",
    "익산", "인제", "인천", "임실", "장성", "장수", "장흥", "전주", "정선", "정읍",
    "제주", "제천", "진도", "진안", "진주", "창녕", "창원", "천안", "철원", "청도",
    "청송", "청양", "청주", "춘천", "칠곡", "통영", "파주", "평창", "평택", "포천",
    "포항", "하남", "하동", "함안", "함양", "합천", "해남", "화성", "화순", "화천",
    "횡성", "홍성", "홍천"
]
HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded"
}

def fetch_store_data(region):
    pagination = {
        "pageNo": 1,
        "itemCountPerPage": 1000,
        "displayPageNoCount": 1000
    }
    payload = {
        "keyword": region,
        "page": pagination["pageNo"],
        "pagination": json.dumps(pagination)
    }

    response = requests.post(URL, data=payload, headers=HEADERS)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch data for region {region}: {response.status_code}")
    return response.json()

def extract_store_info(data):
    store_data = []
    search_results = data.get("searchResult", [])
    for store in search_results:
        store_data.append([
            store.get("storNm", ""),
            store.get("storAddr1", ""),
            store.get("storAddr2", ""),
            store.get("storCd", "")
        ])
    return store_data

def save_to_csv(store_info):
    with open(CSV_FILE, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["storNm", "storAddr1", "storAddr2", "storCd"])
        for store in store_info:
            writer.writerow(store)

def main():
    all_store_info = []

    for region in KOREAN_REGIONS:
        data = fetch_store_data(region)
        store_info = extract_store_info(data)
        all_store_info.extend(store_info)

    save_to_csv(all_store_info)
    print(f"Data saved to {CSV_FILE}")

if __name__ == "__main__":
    main()
