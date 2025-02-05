select 
	encode(tx_used.hash, 'hex'),
	txo.address "from",
	tx_out_used.address "to",
	(
	    SELECT SUM((obj->'fields'->1->'int')::int)/0.98
    	FROM jsonb_array_elements(d.value->'fields'->0->'list') obj
    ) AS price
	,ma."name"
	,ma.fingerprint
	,(select string_agg(json #>> '{}', '' order by key) from tx_metadata tm where tm.tx_id=tx_used.id and key >= 50 and tx_out_used.address='addr1x8rjw3pawl0kelu4mj3c8x20fsczf5pl744s9mxz9v8n7efvjel5h55fgjcxgchp830r7h2l5msrlpt8262r3nvr8ekstg4qrx') cbor
from tx_out txo 
left join datum d on d.hash = txo.data_hash
join tx t on t.id = txo.tx_id
join block b on b.id=t.block_id
join ma_tx_out mto on mto.tx_out_id=txo.id
join multi_asset ma on ma.id=mto.ident
join tx_in ti on ti.tx_out_id=txo.tx_id and ti.tx_out_index=txo.index
join tx tx_used on tx_used.id=ti.tx_in_id
join tx_out tx_out_used on tx_out_used.tx_id=tx_used.id and exists (select ident from ma_tx_out mto_used where mto_used.tx_out_id=tx_out_used.id and mto_used.ident=mto.ident)
where 
	(txo.address = 'addr1x8rjw3pawl0kelu4mj3c8x20fsczf5pl744s9mxz9v8n7efvjel5h55fgjcxgchp830r7h2l5msrlpt8262r3nvr8ekstg4qrx' or tx_out_used.address = 'addr1x8rjw3pawl0kelu4mj3c8x20fsczf5pl744s9mxz9v8n7efvjel5h55fgjcxgchp830r7h2l5msrlpt8262r3nvr8ekstg4qrx')
	and	fingerprint = 'asset104quny2drr95arezw520mwrg80mz3g64awef55'
	--and b.time >= NOW() - INTERVAL '24 hours'
order by b.block_no desc

CREATE INDEX idx_ma_tx_out_ident_txid
    ON ma_tx_out(ident, tx_out_id);

CREATE INDEX idx_tx_out_address_id
    ON tx_out(address, id);


