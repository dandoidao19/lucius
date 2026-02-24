from playwright.sync_api import sync_playwright

def verify_mobile_dashboard():
    with sync_playwright() as p:
        device = p.devices['iPhone 13']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**device)
        page = context.new_page()

        try:
            page.goto("http://localhost:3005")

            # Login
            page.fill('input[type="email"]', 'teste@lojamaju.com')
            page.fill('input[type="password"]', '123456')
            page.click('text=Entrar / Cadastrar')

            # Wait for dashboard to load
            page.wait_for_selector('text=Dashboard Principal', timeout=10000)
            page.wait_for_timeout(3000) # Give extra time for data fetching

            page.screenshot(path="mobile_verification_dashboard.png", full_page=True)
            print("Screenshot of dashboard taken.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_screenshot.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_mobile_dashboard()
