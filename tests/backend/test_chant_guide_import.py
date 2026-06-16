from __future__ import annotations

from scripts.import_chant_guide import apply_result, build_import_result


def test_chant_guide_import_matches_line_id_and_text() -> None:
    payload = song_payload(notes=[])
    guide = {
        "songId": "song_test",
        "guideLines": [
            {
                "lineId": "l1",
                "lineMatchText": "꽃은 피고",
                "notes": [
                    {
                        "type": "chant",
                        "mode": "inline",
                        "label": "sing-along",
                        "text": "피고",
                        "placement": "inline",
                        "anchor": {"matchText": "피고", "occurrence": 1, "charStart": 3, "charEnd": 5},
                    }
                ],
            }
        ],
    }

    result = build_import_result(guide, payload)

    assert result["needsReview"] == []
    assert result["lineUpdates"]["l1"] == [
        {
            "type": "chant",
            "mode": "inline",
            "label": "sing-along",
            "text": "피고",
            "placement": "inline",
            "anchor": {"matchText": "피고", "occurrence": 1, "charStart": 3, "charEnd": 5},
            "romanizedText": "pigo",
        }
    ]


def test_chant_guide_import_rejects_line_id_text_mismatch() -> None:
    payload = song_payload(notes=[])
    guide = {
        "songId": "song_test",
        "guideLines": [
            {
                "lineId": "l1",
                "lineMatchText": "꽃은 지고",
                "notes": [{"type": "chant", "text": "지고"}],
            }
        ],
    }

    result = build_import_result(guide, payload)

    assert result["appliedChanges"] == []
    assert result["needsReview"][0]["reason"] == "lineId text does not match lineMatchText"


def test_chant_guide_apply_replaces_chant_notes_only(tmp_path, monkeypatch) -> None:
    import scripts.import_chant_guide as importer

    monkeypatch.setattr(importer, "ROOT", tmp_path)
    song_path = tmp_path / "data" / "songs" / "song_test.json"
    guide_path = tmp_path / "data" / "chant-guides" / "song_test.json"
    payload = song_payload(notes=[{"type": "study", "text": "keep"}, {"type": "chant", "text": "old"}])
    song_record = {"id": "song_test", "lyrics_json": importer.json_dumps(payload)}
    guide = {
        "songId": "song_test",
        "guideLines": [
            {"lineId": "l1", "lineMatchText": "꽃은 피고", "notes": [{"type": "chant", "text": "피고"}]},
            {"lineId": "missing", "lineMatchText": "없는 줄", "notes": [{"type": "chant", "text": "skip"}]},
        ],
    }
    song_path.parent.mkdir(parents=True)
    guide_path.parent.mkdir(parents=True)
    importer.write_json(song_path, song_record)
    importer.write_json(guide_path, guide)
    result = build_import_result(guide, payload)

    apply_result(guide_path, guide, song_path, song_record, payload, result)

    updated = importer.read_json(song_path)
    updated_payload = importer.json_loads(updated["lyrics_json"], {})
    assert updated_payload["lyrics"][0]["notes"] == [
        {"type": "study", "text": "keep"},
        {"type": "chant", "text": "피고", "romanizedText": "pigo"},
    ]
    assert importer.read_json(guide_path)["needsReview"][0]["reason"] == "unknown lineId: missing"
    assert list((tmp_path / "data" / "backups" / "songs").glob("song_test.*.json"))


def song_payload(notes: list[dict]) -> dict:
    return {
        "id": "song_test",
        "title": "Test",
        "artist": "Tester",
        "audio": {"sourceId": "src_test", "playbackUrl": "/media/test.mp3"},
        "lyrics": [
            {
                "id": "l1",
                "start": 0,
                "end": 1,
                "text": "꽃은 피고",
                "translation": None,
                "confidence": 0.9,
                "segments": [],
                "notes": notes,
            }
        ],
    }
