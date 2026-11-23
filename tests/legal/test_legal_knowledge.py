def test_legal_documents_are_seeded(client):
    response = client.get("/api/v1/legal/documents")
    assert response.status_code == 200
    documents = response.json()["documents"]
    titles = {item["title"] for item in documents}
    assert "中华人民共和国劳动合同法" in titles
    assert "中华人民共和国劳动争议调解仲裁法" in titles
    assert "保障农民工工资支付条例" in titles
    assert "劳动保障监察条例" in titles
    assert "中华人民共和国法律援助法" in titles
    assert any(item["region_name"] == "河南省" for item in documents)
    assert all(item["verification_status"] in ("verified", "transcribed", "pending") for item in documents)


def test_retrieval_finds_construction_wage_rules(client):
    response = client.get(
        "/api/v1/legal/search",
        params={"q": "郑州 建筑工地 欠薪 包工头 总包 分包", "top_k": 10},
    )
    assert response.status_code == 200
    data = response.json()
    ids = {item["id"] for item in data["results"]}
    assert "mwpr-30" in ids
    # A Henan location surfaces local provisions alongside national rules.
    assert any(item.startswith(("hnlsr-", "hnbzj-", "hnzh-")) for item in ids)
    assert data["results"][0]["document"]["official_url"]


def test_national_scope_excludes_henan_provisions(client):
    response = client.get(
        "/api/v1/legal/search",
        params={"q": "建筑工地 欠薪 包工头 总包 分包 工资 支付", "top_k": 10, "region": "national"},
    )
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["results"]}
    assert "lcl-30" in ids
    assert not any(item.startswith(("hnlsr-", "hnbzj-", "hnzh-")) for item in ids)

    limitation = client.get(
        "/api/v1/legal/search",
        params={"q": "劳动保障监察 时效 2年 查处", "top_k": 5, "region": "national"},
    )
    assert "lsr-20" in {item["id"] for item in limitation.json()["results"]}


def test_regions_cover_henan_counties(client):
    response = client.get("/api/v1/regions/henan")
    assert response.status_code == 200
    data = response.json()
    cities = {item["name"]: item for item in data["cities"]}
    assert len(cities) == 18
    assert "金水区" in cities["郑州市"]["districts"]
    assert "兰考县" in cities["开封市"]["districts"]
    assert "管辖权" in data["note"] or "受理机构" in data["note"]


def test_channels_marked_with_verification_status(client):
    response = client.get("/api/v1/channels")
    assert response.status_code == 200
    channels = response.json()["channels"]
    names = {item["name"] for item in channels}
    assert "全国根治欠薪线索反映平台" in names
    assert "12333 人力资源社会保障服务热线" in names
    assert all(item["verification_status"] for item in channels)
