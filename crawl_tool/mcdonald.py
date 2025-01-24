from selenium import webdriver
from selenium.webdriver.edge.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.options import Options
import time
import csv

WEBDRIVER_PATH = "C:\\msedgedriver.exe"
CSV_FILE = "mcdonalds_stores.csv"
URL = "https://www.mcdonalds.co.kr/kor/store/list.do"

# WebDriver 설정
def setup_webdriver():
    options = Options()
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("window-size=1920x1080")
    service = Service(WEBDRIVER_PATH)
    return webdriver.Edge(service=service, options=options)

def fetch_store_data(driver):
    store_data = []
    driver.get(URL)
    page = 1

    while True:
        time.sleep(1)
        driver.execute_script(f"javascript:page({page});")
        time.sleep(0.15)

        store_elements = driver.find_elements(By.CSS_SELECTOR, "td.tdName dl.name")
        if not store_elements:
            break

        for store_element in store_elements:
            store_name = store_element.find_element(By.CSS_SELECTOR, "strong.tit a").text.strip()
            road_address = store_element.find_element(By.CSS_SELECTOR, "dd.road").text.strip()
            store_data.append([store_name, road_address])

        page += 1

    return store_data

def save_to_csv(store_info):
    with open(CSV_FILE, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["storNm", "storAddr"])
        for store in store_info:
            writer.writerow(store)

def main():
    driver = setup_webdriver()
    try:
        store_info = fetch_store_data(driver)
        save_to_csv(store_info)
        print(f"Data saved to {CSV_FILE}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()