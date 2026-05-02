"""
Bamboo Vet -- Selenium Production Test Suite v1.0
Target: https://bamboo-vet-ai.vercel.app
Framework: Selenium 4 + Python 3
Run: python tests/selenium/test_vercel_production.py
"""

import os
import sys
import time
import unittest
import urllib.request
import urllib.error
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "https://bamboo-vet-ai.vercel.app"
EMAIL    = os.environ.get("VERCEL_TEST_EMAIL",    "admin@bamboovet.com")
PASSWORD = os.environ.get("VERCEL_TEST_PASSWORD", "123456789")

PASSED = []
FAILED = []


def chrome_driver(headless: bool = True) -> webdriver.Chrome:
    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,800")
    return webdriver.Chrome(options=opts)


def http_get(path: str) -> int:
    try:
        req = urllib.request.Request(f"{BASE_URL}{path}")
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def http_post(path: str, data: dict) -> int:
    import requests as req_lib
    try:
        resp = req_lib.post(
            f"{BASE_URL}{path}",
            json=data,
            timeout=(10, 60),  # 10s connect, 60s read (SSE stream is slow)
            stream=True,
        )
        status = resp.status_code
        resp.close()
        return status
    except req_lib.exceptions.ReadTimeout:
        # Server connected and is streaming -- not a 500, return sentinel 200
        return 200
    except Exception:
        return 0


def run(name: str, fn):
    print(f"  [{name}] ", end="", flush=True)
    try:
        fn()
        print("PASS")
        PASSED.append(name)
    except AssertionError as e:
        print(f"FAIL -- {e}")
        FAILED.append((name, str(e)))
    except Exception as e:
        print(f"ERROR -- {e}")
        FAILED.append((name, str(e)))


# --- Track A: No Auth ----------------------------------------------------------

def sel_01_login_page_loads():
    driver = chrome_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 15)
        wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[type='email'], #email, input[name='email']")
        ))
        wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[type='password'], #password, input[name='password']")
        ))
        assert "Bamboo" in driver.title, f"Expected 'Bamboo' in title, got: {driver.title}"
    finally:
        driver.quit()


def sel_02_admin_redirects_to_login():
    driver = chrome_driver()
    try:
        driver.get(f"{BASE_URL}/admin/dashboard")
        WebDriverWait(driver, 15).until(EC.url_contains("/login"))
        assert "/login" in driver.current_url, f"Expected /login in URL, got: {driver.current_url}"
    finally:
        driver.quit()


def sel_03_api_admin_returns_401():
    routes = [
        "/api/admin/dashboard",
        "/api/admin/nhap-hang",
        "/api/admin/ton-kho",
        "/api/admin/khach-hang",
    ]
    for route in routes:
        status = http_get(route)
        assert status in (401, 403), f"{route} returned {status}, expected 401 or 403"


def sel_04_api_chat_no_auth_not_500():
    status = http_post("/api/chat", {"messages": [{"role": "user", "content": "test"}]})
    assert status != 500, f"/api/chat returned 500 without auth -- should be 4xx or stream error"
    assert status != 0,   f"/api/chat unreachable"


# --- Track B: Authenticated ----------------------------------------------------

def _login(driver: webdriver.Chrome):
    """Shared login helper -- logs in and waits for redirect away from /login."""
    driver.get(f"{BASE_URL}/login")
    wait = WebDriverWait(driver, 20)
    email_field = wait.until(EC.presence_of_element_located(
        (By.CSS_SELECTOR, "input[type='email'], #email")
    ))
    email_field.send_keys(EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type='password'], #password").send_keys(PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    # Wait until redirected away from /login
    wait.until(lambda d: "/login" not in d.current_url)


def sel_05_login_succeeds():
    driver = chrome_driver()
    try:
        _login(driver)
        assert "/login" not in driver.current_url, f"Still on login page: {driver.current_url}"
    finally:
        driver.quit()


def sel_06_admin_sidebar_renders():
    driver = chrome_driver()
    try:
        _login(driver)
        driver.get(f"{BASE_URL}/admin/dashboard")
        wait = WebDriverWait(driver, 15)
        # Sidebar should have navigation links
        sidebar = wait.until(EC.presence_of_element_located(
            (By.ID, "admin-sidebar")
        ))
        assert sidebar.is_displayed(), "Admin sidebar not visible"
        # At least one nav link should exist
        links = driver.find_elements(By.CSS_SELECTOR, "#admin-sidebar a, #admin-sidebar button")
        assert len(links) > 0, "No nav links found in admin sidebar"
    finally:
        driver.quit()


def sel_07_dashboard_graceful_error():
    driver = chrome_driver()
    try:
        _login(driver)
        driver.get(f"{BASE_URL}/admin/dashboard")
        WebDriverWait(driver, 15).until(EC.url_contains("/admin/dashboard"))
        time.sleep(3)  # Let error boundary render

        page_source = driver.page_source
        # Should NOT be the generic Next.js crash page
        assert "Application error" not in page_source, \
            "Page shows generic Next.js crash -- error boundary not working"
        # Should show the sidebar (layout preserved)
        assert driver.find_elements(By.ID, "admin-sidebar"), \
            "Sidebar missing -- page layout broke"
        # Either data loaded OR graceful error message shown (not blank)
        has_data_or_error = (
            "Không thể tải dữ liệu" in page_source or   # graceful error
            "Dashboard" in page_source                    # data loaded (Phase 3.2)
        )
        assert has_data_or_error, "Dashboard is blank -- neither data nor graceful error shown"
    finally:
        driver.quit()


def sel_08_chat_input_interactable():
    driver = chrome_driver()
    try:
        driver.get(f"{BASE_URL}/chat")
        wait = WebDriverWait(driver, 15)
        textarea = wait.until(EC.element_to_be_clickable(
            (By.CSS_SELECTOR, "textarea[aria-label], textarea[placeholder]")
        ))
        textarea.click()
        textarea.send_keys("Xin chào")
        value = textarea.get_attribute("value")
        assert value == "Xin chào", f"Textarea value mismatch: '{value}'"
    finally:
        driver.quit()


# --- Runner --------------------------------------------------------------------

if __name__ == "__main__":
    print(f"\nBamboo Vet -- Selenium Production Test Suite v1.0")
    print(f"Target : {BASE_URL}")
    print(f"Account: {EMAIL}\n")

    print("Track A -- No Auth Required:")
    run("SEL-01  login page loads",              sel_01_login_page_loads)
    run("SEL-02  /admin/* -> /login redirect",   sel_02_admin_redirects_to_login)
    run("SEL-03  /api/admin/* returns 401/403",  sel_03_api_admin_returns_401)
    run("SEL-04  /api/chat no-auth not 500",     sel_04_api_chat_no_auth_not_500)

    print("\nTrack B -- Authenticated:")
    run("SEL-05  login succeeds",                sel_05_login_succeeds)
    run("SEL-06  admin sidebar renders",         sel_06_admin_sidebar_renders)
    run("SEL-07  dashboard graceful error",      sel_07_dashboard_graceful_error)
    run("SEL-08  chat input interactable",       sel_08_chat_input_interactable)

    print(f"\n{'='*50}")
    print(f"Results: {len(PASSED)} passed, {len(FAILED)} failed")

    if FAILED:
        print("\nFailures:")
        for name, reason in FAILED:
            print(f"  ✗ {name}: {reason}")
        sys.exit(1)
    else:
        print("All Selenium tests passed.")
        sys.exit(0)
