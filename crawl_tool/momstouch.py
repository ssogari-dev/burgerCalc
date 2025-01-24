import requests
import re
import csv

# 상수 정의
URL = "https://momstouch.co.kr/store/inner_shop_list.php"
CSV_FILE = "momstouch_stores.csv"

# 정규식으로 텍스트 클리닝
def clean_text(text):
    return re.sub(r"\s*&nbsp;\s*|\\n|\\t", " ", text).strip()

def fetch_store_data(sido):
    params = {
        "s_area_sido": f"{sido:03d}",
        "s_area_sigun": "",
        "type": "area"
    }
    response = requests.post(URL, data=params)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch data for sido {sido}: {response.status_code}")
    return response.text

def extract_store_info(html_content):
    store_data = []
    li_pattern = re.compile(r"<li>.*?<dt><span.*?>(.*?)</span></dt>.*?<dd>(.*?)</dd>", re.DOTALL)
    matches = li_pattern.findall(html_content)

    for match in matches:
        name = clean_text(match[0])
        address = clean_text(match[1]).replace(",", "")
        store_data.append([name, address])
    return store_data

def save_to_csv(store_info):
    with open(CSV_FILE, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["storNm", "storAddr"])
        for store in store_info:
            writer.writerow(store)

def main():
    with open(CSV_FILE, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["storNm", "storAddr"])

    for sido in range(1, 18):
        html_content = fetch_store_data(sido)
        store_info = extract_store_info(html_content)
        save_to_csv(store_info)

    print(f"Data saved to {CSV_FILE}")

if __name__ == "__main__":
    main()
