import requests
import json
import html
import csv

# 상수 정의
URL = "https://www.lotteeatz.com/searchStore/getStoresListAjax"
CSV_FILE = "lotteria_stores.csv"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "text/html, */*; q=0.01",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "ko,en;q=0.9,en-US;q=0.8",
    "Origin": "https://www.lotteeatz.com",
    "Referer": "https://www.lotteeatz.com/searchStore",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
    "X-Requested-With": "XMLHttpRequest"
}

PAYLOAD = {
    "query": None,
    "queryType": "NAME",
    "orderType": None,
    "data": {
        "division": {"divcd": ""},
        "adres": {"adres": None, "detailAdres": None},
        "geo": {"point": {"lat": None, "lng": None}},
        "svc": {}
    },
    "radius": 2000,
    "query2_str": "[가-힣]",
    "divcdList": ["10"],
    "page": 1,
    "limit": 2000
}

def fetch_store_data():
    response = requests.post(URL, json=PAYLOAD, headers=HEADERS)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch data: {response.status_code}")
    return response.text

def extract_store_info(response_text):
    try:
        hidden_input = response_text.split('<input type="hidden" name="storeList_JSON" value="')[1]
        raw_json = hidden_input.split('" />')[0]
        decoded_json = html.unescape(raw_json)
        return json.loads(decoded_json)
    except (IndexError, json.JSONDecodeError) as e:
        raise Exception("Failed to extract or decode JSON") from e

def save_to_csv(store_data):
    with open(CSV_FILE, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["storeNm", "adres", "detailAdres", "storecd"])
        for store in store_data:
            writer.writerow([
                store.get("storeNm"),
                store.get("adres", {}).get("adres"),
                store.get("adres", {}).get("detailAdres"),
                store.get("storecd")
            ])

def main():
    response_text = fetch_store_data()
    store_data = extract_store_info(response_text)
    save_to_csv(store_data)
    print(f"Data saved to {CSV_FILE}")

if __name__ == "__main__":
    main()