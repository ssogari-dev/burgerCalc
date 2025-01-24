from selenium import webdriver
from selenium.webdriver.edge.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.options import Options
import time
import os
import csv

# 상수 정의
WEBDRIVER_PATH = os.path.join("C:\\", "msedgedriver.exe")
OUTPUT_FILE = "kfc_stores.csv"
URL = "https://www.kfckorea.com/store/findStore"

# WebDriver 옵션 설정
def setup_webdriver():
    options = Options()
    # options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("window-size=1920x1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36")
    service = Service(WEBDRIVER_PATH)
    return webdriver.Edge(service=service, options=options)

def navigate_to_region_search_tab(driver):
    driver.get(URL)
    time.sleep(2)
    tab_region_search = driver.find_element(By.XPATH, "//ul[@class='tab']/li/a[text()='지역검색']")
    tab_region_search.click()

def extract_store_data(driver):
    store_data = []
    select_box = driver.find_element(By.CSS_SELECTOR, ".select-region select")
    options = select_box.find_elements(By.TAG_NAME, "option")
    region_options = [option for option in options if option.get_attribute("value")]

    for region_option in region_options:
        region_option.click()
        time.sleep(0.2)
        town_select_box = driver.find_element(By.CSS_SELECTOR, ".select-region select.town")
        town_options = town_select_box.find_elements(By.TAG_NAME, "option")
        town_list = [town_option for town_option in town_options if town_option.get_attribute("value")]

        for town_option in town_list:
            town_option.click()
            time.sleep(0.2)
            store_items = driver.find_elements(By.CSS_SELECTOR, ".store-item")

            for store_item in store_items:
                store_name = store_item.find_element(By.CSS_SELECTOR, ".top a").text
                store_address = store_item.find_element(By.CSS_SELECTOR, "li.num").find_element(By.XPATH, "preceding-sibling::li[1]").text
                store_data.append((store_name, store_address, region_option.text, town_option.text))

        select_box = driver.find_element(By.CSS_SELECTOR, ".select-region select")
        options = select_box.find_elements(By.TAG_NAME, "option")
        region_options = [option for option in options if option.get_attribute("value")]

    return store_data

def save_to_csv(store_data):
    with open(OUTPUT_FILE, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["Store Name", "Address", "Region", "Town"])
        writer.writerows(store_data)

def main():
    driver = setup_webdriver()
    try:
        navigate_to_region_search_tab(driver)
        store_data = extract_store_data(driver)
        save_to_csv(store_data)
        print(f"Data saved to {OUTPUT_FILE}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
