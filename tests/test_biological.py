import json
import joblib
import pandas as pd
from sklearn.linear_model import LinearRegression
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core import config


def setup_data(tmp_path, monkeypatch):
    monkeypatch.setattr(config, 'PROJECT_ROOT', tmp_path)
    monkeypatch.setattr(config, 'MODELS_DIR', tmp_path / 'models')
    folder = tmp_path / 'data/raw'
    folder.mkdir(parents=True)
    row = dict(SAMPLE_ID='sample1', PDB_ID='3TKW', UNIPROT_ID='P03366', CHAIN_ID='B', MUTATION='I54V', CID='213039', DRUG='17', SMILES='CCO', a=3, **{'DDG.EXP':999})
    path = folder / 'MdrDB_Full_Scraped.csv'
    pd.DataFrame([row]).to_csv(path,index=False)
    modeldir = config.MODELS_DIR / 'linear_regression/model_A'
    modeldir.mkdir(parents=True)
    joblib.dump(LinearRegression().fit(pd.DataFrame({'a':[0.,1.,2.]}),[1.,3.,5.]),modeldir / 'model.joblib')
    (modeldir / 'features.json').write_text(json.dumps(['a']))
    return path, row


def request():
    return dict(protein_id='p03366', mutation='i54v', drug='213039', algorithm='linear_regression')


def test_biological_identity_inference(tmp_path, monkeypatch, authenticated_user):
    setup_data(tmp_path, monkeypatch)
    client=TestClient(app)
    response=client.post('/api/predict/biological',json=request())
    assert response.status_code==200, response.text
    data=response.json()
    assert abs(data['prediction']-7)<1e-8
    assert data['experimental_ddg']==999 # target is never fed to model
    assert data['record']['sample_id']=='sample1'
    assert data['descriptor_count']==1
    assert client.get('/api/biological/example').json()['drug']=='213039'
    assert client.post('/api/predict/biological',json={**request(),'drug':'99'}).status_code==422
    assert client.post('/api/predict/biological',json={**request(),'mutation':'I54A'}).status_code==422
    assert client.post('/api/predict/biological',json={**request(),'drug_type':'smiles','drug':'CCO'}).status_code==200
    assert client.post('/api/predict/biological',json={**request(),'drug':'darunavir'}).status_code==422


def test_ambiguity_and_sample_identity(tmp_path, monkeypatch, authenticated_user):
    path,row=setup_data(tmp_path,monkeypatch)
    pd.DataFrame([row,{**row,'SAMPLE_ID':'sample2','CHAIN_ID':'A','a':4}]).to_csv(path,index=False)
    client=TestClient(app)
    response=client.post('/api/predict/biological',json=request())
    assert response.status_code==409
    assert len(response.json()['detail']['candidates'])==2
    assert client.post('/api/predict/biological',json={**request(),'sample_id':'sample2'}).json()['record']['chain_id']=='A'
    assert client.post('/api/predict/biological',json={**request(),'sample_id':'sample2','drug':'99'}).status_code==422


def test_biological_auth():
    client=TestClient(app)
    assert client.post('/api/predict/biological',json=request()).status_code==401
    assert client.get('/api/biological/example').status_code==401


def test_all_missing_rejected(tmp_path, monkeypatch, authenticated_user):
    setup_data(tmp_path,monkeypatch)
    response=TestClient(app).post('/api/predict',json={'algorithm':'linear_regression','features':{'a':None}})
    assert response.status_code==422
    assert 'All descriptors are missing' in response.json()['detail']
