import requests
import csv

# 상수 정의
URL = "https://www.burgerking.co.kr/burgerking/BKR0343.json"
DATA_COUNT = 600
CSV_FILE = "burgerking_stores.csv"

# 요청 데이터와 헤더 정의
PAYLOAD = {
    "message": f"{{\"header\":{{\"result\":true,\"error_code\":\"\",\"error_text\":\"\",\"info_text\":\"\",\"message_version\":\"\",\"login_session_id\":\"\",\"trcode\":\"BKR0343\",\"cd_call_chnn\":\"01\"}},\"body\":{{\"dataCount\":\"{DATA_COUNT}\",\"membershipYn\":\"\",\"orderType\":\"01\",\"page\":\"1\",\"searchKeyword\":\"\",\"serviceCode\":[],\"sort\":\"02\",\"yCoordinates\":\"37.5726506\",\"xCoordinates\":\"126.9810922\",\"isAllYn\":\"Y\"}}}}"
}
HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept": "*/*",
    "Origin": "https://www.burgerking.co.kr",
    "Referer": "https://www.burgerking.co.kr/store/all",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0"
}

def fetch_store_data():
    response = requests.post(URL, data=PAYLOAD, headers=HEADERS)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch data: {response.status_code}")
    return response.json()

def extract_store_info(response_data):
    return response_data.get("body", {}).get("storInfo", [])

def save_to_csv(store_info):
    with open(CSV_FILE, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["storNm", "storAddr"])
        for store in store_info:
            writer.writerow([
                store.get("storNm", ""),
                store.get("storAddr", "")
            ])

def main():
    response_data = fetch_store_data()
    store_info = extract_store_info(response_data)
    save_to_csv(store_info)
    print(f"Data saved to {CSV_FILE}")

if __name__ == "__main__":
    main()
